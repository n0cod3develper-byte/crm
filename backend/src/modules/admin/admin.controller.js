import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { invalidarCacheUsuario, invalidarTodoElCache, obtenerPermisosUsuario } from '../../middleware/auth.js';

// ─── Roles (RBAC opcional) ─────────────────────────────────────

export async function listarRoles(req, res) {
  try {
    // La tabla 'roles' puede no existir si RBAC no está configurado
    const sql = `SELECT id, nombre, slug, descripcion, activo FROM roles ORDER BY nombre ASC`;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    // Si la tabla no existe, devolver lista vacía
    res.json([]);
  }
}

export async function obtenerDetalleRol(req, res) {
  const { id } = req.params;
  try {
    const rolSql = `SELECT id, nombre, slug, descripcion, activo FROM roles WHERE id = $1`;
    const permisosSql = `
      SELECT ms.id as modulo_id, ms.nombre as modulo_nombre, ms.slug as modulo_slug,
             rp.puede_ver, rp.puede_crear, rp.puede_editar, rp.puede_eliminar,
             rp.puede_exportar, rp.puede_aprobar, rp.puede_liquidar
      FROM roles_permisos rp
      JOIN modulos_sistema ms ON rp.modulo_id = ms.id
      WHERE rp.rol_id = $1
    `;
    const [rolResult, permisosResult] = await Promise.all([
      query(rolSql, [id]),
      query(permisosSql, [id]).catch(() => ({ rows: [] }))
    ]);

    if (rolResult.rows.length === 0) return res.status(404).json({ error: 'Rol no encontrado' });

    res.json({
      ...rolResult.rows[0],
      permisos: permisosResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo detalle del rol' });
  }
}

export async function actualizarPermisosRol(req, res) {
  const { id } = req.params;
  const { permisos, ejecutado_por } = req.body;

  try {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM roles_permisos WHERE rol_id = $1', [id]);
      for (const p of permisos) {
        await client.query(`
          INSERT INTO roles_permisos (
            rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar,
            puede_exportar, puede_aprobar, puede_liquidar
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [id, p.modulo_id, p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar,
           p.puede_exportar, p.puede_aprobar, p.puede_liquidar]);
      }
      // Auditoría (tabla puede no existir)
      await client.query(`
        INSERT INTO auditoria_permisos (accion, ejecutado_por, entidad_tipo, entidad_id, detalle)
        VALUES ('UPDATE_PERMISSIONS', $1, 'ROL', $2, $3)
      `, [ejecutado_por, id, JSON.stringify(permisos)]).catch(() => {});
    });

    invalidarTodoElCache();
    res.json({ success: true, message: 'Permisos actualizados correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando permisos' });
  }
}

// ─── Usuarios ──────────────────────────────────────────────────

export async function invitarUsuario(req, res) {
  const { email, role = 'user' } = req.body;

  try {
    const exists = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya está registrado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 48);

    await query(`
      INSERT INTO users (email, role, invitation_token, invitation_expires, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
    `, [email, role, token, expires]);

    const invitationLink = `${env.FRONTEND_URL}/register?token=${token}`;
    res.json({ success: true, invitationLink });
  } catch (err) {
    logger.error('Error inviting user', { error: err.message });
    res.status(500).json({ error: 'Error al generar invitación' });
  }
}

export async function listarUsuarios(req, res) {
  const { role, activo, q, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (role) {
      params.push(role);
      where += ` AND u.role = $${params.length}`;
    }
    // Soporte para el parámetro 'estado' (legacy) o 'activo'
    const estadoParam = req.query.estado || activo;
    if (estadoParam !== undefined && estadoParam !== '') {
      const isActive = estadoParam === 'ACTIVO' || estadoParam === 'true' || estadoParam === true;
      params.push(isActive);
      where += ` AND u.is_active = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    const sql = `
      SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, u.is_active, u.created_at, u.updated_at
      FROM users u
      ${where}
      ORDER BY u.full_name ASC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `SELECT COUNT(*)::INT as total FROM users u ${where}`;

    const [usersResult, countResult] = await Promise.all([
      query(sql, [...params, parseInt(limit), offset]),
      query(countSql, params)
    ]);

    res.json({
      success: true,
      data: usersResult.rows,
      pagination: {
        total: countResult.rows[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    logger.error('Error listing users', { error: err.message });
    res.status(500).json({ error: 'Error listando usuarios' });
  }
}

export async function cambiarRolUsuario(req, res) {
  const { id } = req.params;
  // Soporta tanto 'role' (nuevo) como 'rol_id' (legacy) del body
  const { role, rol_id, ejecutado_por } = req.body;
  const newRole = role || 'user';

  try {
    const result = await query(
      `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, role`,
      [id, newRole]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Auditoría opcional
    await query(`
      INSERT INTO auditoria_permisos (accion, ejecutado_por, entidad_tipo, entidad_id, detalle)
      VALUES ('CHANGE_USER_ROLE', $1, 'USUARIO', $2, $3)
    `, [ejecutado_por || req.userId, id, JSON.stringify({ nuevo_role: newRole })]).catch(() => {});

    invalidarCacheUsuario(id);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error cambiando rol' });
  }
}

export async function activarDesactivarUsuario(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    const result = await query(
      `UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, role, is_active`,
      [id, is_active]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    invalidarCacheUsuario(id);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
}

export async function cambiarPasswordAdmin(req, res) {
  const { id } = req.params;
  const { password } = req.body;

  try {
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const hash = await bcrypt.hash(password, 10);
    await query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [id, hash]);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando contraseña' });
  }
}

// ─── Usuario Autenticado ──────────────────────────────────────

export async function miInformacion(req, res) {
  try {
    const userId = req.userId;

    const [permisos, userResult] = await Promise.all([
      obtenerPermisosUsuario(userId).catch(() => ({ rol: null, permisos: {} })),
      query(`SELECT id, full_name, email, avatar_url, role, is_active FROM users WHERE id = $1`, [userId])
    ]);

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const rolFinal = permisos.rol || { slug: user.role, nombre: user.role };

    res.json({
      ...user,
      rol: rolFinal,
      permisos: permisos.permisos || {},
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
}
