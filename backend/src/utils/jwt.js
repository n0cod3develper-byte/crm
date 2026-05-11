import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * Genera un par de tokens: access (1h) + refresh (7d)
 */
export function generateTokenPair(userId) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Verifica un token de acceso
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError('Token expirado', 401);
    throw new AppError('Token inválido', 401);
  }
}

/**
 * Middleware: verifica la autenticación mediante JWT propio
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token de acceso requerido', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') throw new AppError('Tipo de token incorrecto', 401);

    // Carga el usuario desde la tabla users
    const sql = `
      SELECT u.id, u.email, u.nombre, u.apellido, u.estado, r.slug as role 
      FROM users u
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1
    `;
    const result = await query(sql, [payload.sub]);
    const user = result.rows[0];

    if (!user) throw new AppError('Usuario no encontrado', 401);
    if (user.estado !== 'ACTIVO') throw new AppError('Cuenta desactivada', 403);

    // Compatibilidad
    user.full_name = `${user.nombre} ${user.apellido || ''}`.trim();
    user.is_active = user.estado === 'ACTIVO';

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: verifica rol mínimo requerido
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role) && !roles.includes('*')) {
      return next(new AppError('No tienes permisos para esta acción', 403));
    }
    next();
  };
}
