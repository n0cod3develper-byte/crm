import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { invalidarCacheUsuario, invalidarTodoElCache, obtenerPermisosUsuario } from '../../middleware/auth.js';


// ─── Roles ───────────────────────────────────────────────────

export async function listarRoles(req, res) {
  try {
    const sql = `SELECT id, nombre, slug, descripcion, activo FROM roles ORDER BY nombre ASC`;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error listando roles' });
  }
}

export async function obtenerDetalleRol(req, res) {
  const { id } = req.params;
  try {
    const rolSql = `SELECT id, nombre, slug, descripcion, activo FROM roles WHERE id = $1`;
    const permisosSql = `
      SELECT ms.id as modulo_id, ms.nombre as modulo_nombre, ms.slug as modulo_slug,
             COALESCE(rp.puede_ver, false) as puede_ver,
             COALESCE(rp.puede_crear, false) as puede_crear,
             COALESCE(rp.puede_editar, false) as puede_editar,
             COALESCE(rp.puede_eliminar, false) as puede_eliminar,
             COALESCE(rp.puede_exportar, false) as puede_exportar,
             COALESCE(rp.puede_aprobar, false) as puede_aprobar,
             COALESCE(rp.puede_liquidar, false) as puede_liquidar
      FROM modulos_sistema ms
      LEFT JOIN roles_permisos rp ON rp.modulo_id = ms.id AND rp.rol_id = $1
      ORDER BY ms.orden_menu, ms.nombre
    `;
    
    const [rolResult, permisosResult] = await Promise.all([
      query(rolSql, [id]),
      query(permisosSql, [id])
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
      // 1. Eliminar permisos actuales
      await client.query('DELETE FROM roles_permisos WHERE rol_id = $1', [id]);

      // 2. Insertar nuevos permisos
      for (const p of permisos) {
        const sql = `
          INSERT INTO roles_permisos (
            rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar,
            puede_exportar, puede_aprobar, puede_liquidar
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(sql, [
          id, p.modulo_id, p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar,
          p.puede_exportar, p.puede_aprobar, p.puede_liquidar
        ]);
      }

      // 3. Auditoría
      const auditSql = `
        INSERT INTO auditoria_permisos (accion, ejecutado_por, entidad_tipo, entidad_id, detalle)
        VALUES ('UPDATE_PERMISSIONS', $1, 'ROL', $2, $3)
      `;
      await client.query(auditSql, [ejecutado_por, id, JSON.stringify(permisos)]);
    });

    // 4. Invalidar caché global de permisos
    invalidarTodoElCache();

    res.json({ success: true, message: 'Permisos actualizados correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando permisos' });
  }
}


// ─── Usuarios ─────────────────────────────────────────────────

export async function invitarUsuario(req, res) {
  const { email, rol_id } = req.body;

  try {
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya está registrado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 48);

    const insertSql = `
      INSERT INTO users (email, nombre, full_name, rol_id, invitation_token, invitation_expires, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
    `;
    await query(insertSql, [email, 'Invitado', 'Invitado', rol_id, token, expires]);

    const invitationLink = `${env.FRONTEND_URL}/register?token=${token}`;
    res.json({ success: true, invitationLink });
  } catch (err) {
    console.error('Error en invitarUsuario:', err);
    res.status(500).json({ error: 'Error al generar invitación' });
  }
}

export async function listarUsuarios(req, res) {
  const { rol, estado, q, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (rol) {
      params.push(rol);
      where += ` AND r.slug = $${params.length}`;
    }
    if (estado) {
      params.push(estado);
      where += ` AND u.estado = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (u.nombre ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    const sql = `
      SELECT u.id, u.nombre, u.apellido, u.email, u.avatar_url, u.estado, u.updated_at,
             r.nombre as rol_nombre, r.slug as rol_slug, r.id as rol_id
      FROM users u
      LEFT JOIN roles r ON u.rol_id = r.id
      ${where}
      ORDER BY u.nombre ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*) 
      FROM users u
      LEFT JOIN roles r ON u.rol_id = r.id
      ${where}
    `;

    const [usersResult, countResult] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);

    res.json({
      success: true,
      data: usersResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error listando usuarios' });
  }
}

export async function cambiarRolUsuario(req, res) {
  const { id } = req.params; // ID interno del usuario
  const { rol_id, ejecutado_por } = req.body;

  try {
    await withTransaction(async (client) => {
      const sql = `UPDATE users SET rol_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`;
      const result = await client.query(sql, [id, rol_id]);

      if (result.rows.length === 0) throw new Error('Usuario no encontrado');

      const auditSql = `
        INSERT INTO auditoria_permisos (accion, ejecutado_por, entidad_tipo, entidad_id, detalle)
        VALUES ('CHANGE_USER_ROLE', $1, 'USUARIO', $2, $3)
      `;
      await client.query(auditSql, [ejecutado_por, id, JSON.stringify({ nuevo_rol_id: rol_id })]);
    });

    invalidarCacheUsuario(id);
    const nuevosPermisos = await obtenerPermisosUsuario(id);
    res.json(nuevosPermisos);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error cambiando rol' });
  }
}

// ─── Usuario Autenticado ─────────────────────────────────────

export async function miInformacion(req, res) {
  try {
    const userId = req.userId; // De requireAuth middleware
    
    const [permisos, userResult] = await Promise.all([
      obtenerPermisosUsuario(userId),
      query(`SELECT nombre, apellido, email, avatar_url, estado FROM users WHERE id = $1`, [userId])
    ]);

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      ...userResult.rows[0],
      ...permisos
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
}

export async function cambiarClaveUsuario(req, res) {
  const { id } = req.params;
  const { password, ejecutado_por } = req.body;

  if (!password || password.trim().length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await withTransaction(async (client) => {
      const sql = `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id`;
      const result = await client.query(sql, [id, passwordHash]);

      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const auditSql = `
        INSERT INTO auditoria_permisos (accion, ejecutado_por, entidad_tipo, entidad_id, detalle)
        VALUES ('CHANGE_USER_PASSWORD', $1, 'USUARIO', $2, $3)
      `;
      await client.query(auditSql, [ejecutado_por, id, JSON.stringify({ note: 'Contraseña cambiada por administrador' })]);
    });

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en cambiarClaveUsuario:', err);
    res.status(500).json({ error: err.message || 'Error al cambiar la contraseña del usuario' });
  }
}

// ─── Módulos del Sistema ────────────────────────────────────────

export async function listarModulos(req, res) {
  try {
    const sql = `SELECT id, nombre, slug, icono, ruta_base, orden_menu, activo FROM modulos_sistema ORDER BY orden_menu ASC, nombre ASC`;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('Error en listarModulos:', err);
    res.status(500).json({ error: 'Error listando módulos' });
  }
}

export async function crearModulo(req, res) {
  const { nombre, slug, icono, ruta_base, orden_menu, activo } = req.body;
  
  if (!nombre || !slug) {
    return res.status(400).json({ error: 'El nombre y slug son obligatorios' });
  }

  try {
    const exists = await query('SELECT id FROM modulos_sistema WHERE slug = $1', [slug]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un módulo con este slug' });
    }

    const sql = `
      INSERT INTO modulos_sistema (nombre, slug, icono, ruta_base, orden_menu, activo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(sql, [nombre, slug, icono || null, ruta_base || null, orden_menu || 0, activo !== false]);
    
    invalidarTodoElCache();
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Módulo creado exitosamente' });
  } catch (err) {
    console.error('Error en crearModulo:', err);
    res.status(500).json({ error: 'Error creando módulo' });
  }
}

export async function actualizarModulo(req, res) {
  const { id } = req.params;
  const { nombre, slug, icono, ruta_base, orden_menu, activo } = req.body;

  if (!nombre || !slug) {
    return res.status(400).json({ error: 'El nombre y slug son obligatorios' });
  }

  try {
    const exists = await query('SELECT id FROM modulos_sistema WHERE slug = $1 AND id != $2', [slug, id]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe otro módulo con este slug' });
    }

    const sql = `
      UPDATE modulos_sistema
      SET nombre = $1, slug = $2, icono = $3, ruta_base = $4, orden_menu = $5, activo = $6
      WHERE id = $7
      RETURNING *
    `;
    const result = await query(sql, [nombre, slug, icono || null, ruta_base || null, orden_menu || 0, activo !== false, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }

    invalidarTodoElCache();
    res.json({ success: true, data: result.rows[0], message: 'Módulo actualizado correctamente' });
  } catch (err) {
    console.error('Error en actualizarModulo:', err);
    res.status(500).json({ error: 'Error actualizando módulo' });
  }
}

export async function eliminarModulo(req, res) {
  const { id } = req.params;

  try {
    const sql = `DELETE FROM modulos_sistema WHERE id = $1 RETURNING *`;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }

    invalidarTodoElCache();
    res.json({ success: true, message: 'Módulo eliminado correctamente' });
  } catch (err) {
    console.error('Error en eliminarModulo:', err);
    res.status(500).json({ error: 'Error eliminando módulo. Verifique que no esté en uso.' });
  }
}
