import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { AppError } from './errors.js';

/**
 * Genera un par de tokens: access (15min) + refresh (7d)
 */
export function generateTokenPair(userId) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

/**
 * Middleware: verifica el JWT de acceso en la cabecera Authorization
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

    // Carga el usuario desde BD (valida que no esté desactivado)
    const result = await query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = result.rows[0];

    if (!user) throw new AppError('Usuario no encontrado', 401);
    if (!user.is_active) throw new AppError('Cuenta desactivada', 403);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: verifica rol mínimo requerido.
 * Usar después de authenticate.
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role) && !roles.includes('*')) {
      return next(new AppError('No tienes permisos para esta acción', 403));
    }
    next();
  };
}
