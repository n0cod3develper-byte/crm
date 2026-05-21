import NodeCache from 'node-cache';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getAccessToken } from '../utils/cookies.js';

const permissionsCache = new NodeCache({ stdTTL: env.PERMISSIONS_CACHE_TTL_SECONDS || 300 });

/**
 * Middleware para requerir autenticación JWT
 * Setea req.userId y req.user
 */
export const requireAuth = async (req, res, next) => {
  try {
    const token = getAccessToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No autorizado - Token no encontrado' });
    }

    const payload = verifyAccessToken(token);
    
    // Buscar usuario en BD
    const userSql = `
      SELECT u.id, u.email, u.nombre, u.apellido, u.estado, r.slug as role 
      FROM users u
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1
    `;
    const result = await query(userSql, [payload.sub]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ error: 'Cuenta desactivada' });
    }

    // Inyectamos datos en el request
    req.userId = user.id;
    req.user = user;
    
    next();
  } catch (err) {
    res.status(401).json({ error: err.message || 'Token inválido' });
  }
};

// Alias para compatibilidad con módulos antiguos
export const authenticate = requireAuth;

/**
 * Middleware: verifica rol mínimo requerido (Compatibilidad)
 */
export function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    
    if (req.user.role === 'admin') return next();

    if (!rolesPermitidos.includes(req.user.role) && !rolesPermitidos.includes('*')) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

/**
 * Obtiene los permisos del usuario desde la BD con caché
 */
export async function obtenerPermisosUsuario(userId) {
  const cached = permissionsCache.get(userId);
  if (cached) return cached;

  try {
    const sql = `
      SELECT 
        r.slug as rol_slug,
        r.nombre as rol_nombre,
        ms.slug as modulo_slug,
        rp.puede_ver,
        rp.puede_crear,
        rp.puede_editar,
        rp.puede_eliminar,
        rp.puede_exportar,
        rp.puede_aprobar,
        rp.puede_liquidar
      FROM users u
      JOIN roles r ON u.rol_id = r.id
      JOIN roles_permisos rp ON r.id = rp.rol_id
      JOIN modulos_sistema ms ON rp.modulo_id = ms.id
      WHERE u.id = $1 AND u.estado = 'ACTIVO' AND r.activo = TRUE
    `;

    const result = await query(sql, [userId]);
    
    if (result.rows.length === 0) {
      return { rol: null, permisos: {} };
    }

    const data = formatData(result.rows);
    permissionsCache.set(userId, data);
    return data;
  } catch (err) {
    logger.error('Error obteniendo permisos de usuario', { userId, error: err.message });
    throw err;
  }
}

function formatData(rows) {
  const permisos = {};
  const rol = {
    slug: rows[0].rol_slug,
    nombre: rows[0].rol_nombre
  };

  rows.forEach(row => {
    permisos[row.modulo_slug] = {
      ver: row.puede_ver,
      crear: row.puede_crear,
      editar: row.puede_editar,
      eliminar: row.puede_eliminar,
      exportar: row.puede_exportar,
      aprobar: row.puede_aprobar,
      liquidar: row.puede_liquidar
    };
  });

  return { rol, permisos };
}

/**
 * Middleware para verificar permisos específicos
 */
export const verificarPermiso = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'No autorizado' });

      const { rol, permisos } = await obtenerPermisosUsuario(userId);

      if (rol?.slug === 'admin') return next();

      const tienePermiso = permisos[modulo]?.[accion] === true;
      if (!tienePermiso) {
        return res.status(403).json({ error: 'Sin permiso para realizar esta acción' });
      }

      req.userCRM = { id: userId, rol, permisos };
      next();
    } catch (err) {
      res.status(500).json({ error: 'Error interno verificando permisos' });
    }
  };
};

/**
 * Middleware para rutas exclusivas de administrador
 */
export const soloAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    const { rol } = await obtenerPermisosUsuario(userId);

    if (rol?.slug !== 'admin') {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: 'Error verificando rol de admin' });
  }
};

export const invalidarCacheUsuario = (userId) => {
  permissionsCache.del(userId);
};

export const invalidarTodoElCache = () => {
  permissionsCache.flushAll();
};
