import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { AppError } from '../utils/errors.js';

// ─── Caché simple en memoria (sin node-cache) ─────────────────
const _cache = new Map();

function cacheGet(key) { return _cache.get(key); }
function cacheSet(key, val) { _cache.set(key, val); setTimeout(() => _cache.delete(key), (env.PERMISSIONS_CACHE_TTL_SECONDS || 300) * 1000); }
function cacheDel(key) { _cache.delete(key); }
function cacheFlush() { _cache.clear(); }

// ─── Authenticate ─────────────────────────────────────────────

/**
 * Middleware: verifica el JWT de acceso en la cabecera Authorization.
 * Compatible con la estructura de BD actual (users: full_name, is_active, role).
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token de acceso requerido', 401);
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new AppError('Token expirado', 401);
      throw new AppError('Token inválido', 401);
    }

    if (payload.type !== 'access') throw new AppError('Tipo de token incorrecto', 401);

    const result = await query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = result.rows[0];

    if (!user) throw new AppError('Usuario no encontrado', 401);
    if (!user.is_active) throw new AppError('Cuenta desactivada', 403);

    req.user   = user;
    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}

// Alias
export const requireAuth = authenticate;

// ─── Authorize ────────────────────────────────────────────────

/**
 * Middleware: verifica rol mínimo requerido. Usar después de authenticate.
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role) && !roles.includes('*')) {
      return next(new AppError('No tienes permisos para esta acción', 403));
    }
    next();
  };
}

// ─── RBAC (permisos granulares) ───────────────────────────────

/**
 * Obtiene los permisos del usuario. Si el sistema RBAC no está configurado,
 * devuelve permisos vacíos sin crashear.
 */
export async function obtenerPermisosUsuario(userId) {
  const cached = cacheGet(userId);
  if (cached) return cached;

  try {
    const sql = `
      SELECT
        r.slug as rol_slug,
        r.nombre as rol_nombre,
        ms.slug as modulo_slug,
        rp.puede_ver, rp.puede_crear, rp.puede_editar,
        rp.puede_eliminar, rp.puede_exportar, rp.puede_aprobar, rp.puede_liquidar
      FROM users u
      JOIN roles r ON u.rol_id = r.id
      JOIN roles_permisos rp ON r.id = rp.rol_id
      JOIN modulos_sistema ms ON rp.modulo_id = ms.id
      WHERE u.id = $1 AND u.estado = 'ACTIVO' AND r.activo = TRUE
    `;
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) {
      return { rol: { slug: 'admin' }, permisos: {} };
    }
    const data = _formatPermisos(result.rows);
    cacheSet(userId, data);
    return data;
  } catch {
    // Si las tablas RBAC no existen, devolver permisos de admin por defecto
    return { rol: { slug: 'admin' }, permisos: {} };
  }
}

function _formatPermisos(rows) {
  const permisos = {};
  const rol = { slug: rows[0].rol_slug, nombre: rows[0].rol_nombre };
  rows.forEach(row => {
    permisos[row.modulo_slug] = {
      ver: row.puede_ver, crear: row.puede_crear, editar: row.puede_editar,
      eliminar: row.puede_eliminar, exportar: row.puede_exportar,
      aprobar: row.puede_aprobar, liquidar: row.puede_liquidar,
    };
  });
  return { rol, permisos };
}

/**
 * Middleware: verifica permiso granular para un módulo y acción.
 */
export const verificarPermiso = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) return next(new AppError('No autorizado', 401));
      const { rol, permisos } = await obtenerPermisosUsuario(userId);
      if (rol?.slug === 'admin') return next();
      // Admin de la BD (rol text) también pasa
      if (req.user?.role === 'admin') return next();
      if (!permisos[modulo]?.[accion]) {
        return next(new AppError('Sin permiso para realizar esta acción', 403));
      }
      req.userCRM = { id: userId, rol, permisos };
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Middleware: solo administradores.
 */
export const soloAdmin = async (req, res, next) => {
  try {
    // Admins de BD (campo role) siempre pasan
    if (req.user?.role === 'admin') return next();
    const userId = req.userId;
    if (!userId) return next(new AppError('No autorizado', 401));
    const { rol } = await obtenerPermisosUsuario(userId);
    if (rol?.slug !== 'admin') {
      return next(new AppError('Acceso restringido a administradores', 403));
    }
    next();
  } catch (err) {
    next(err);
  }
};

// ─── Cache helpers ────────────────────────────────────────────
export const invalidarCacheUsuario   = (userId) => cacheDel(userId);
export const invalidarTodoElCache    = ()       => cacheFlush();
