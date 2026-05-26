import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * Genera un par de tokens: access + refresh
 * Cada refresh token incluye un jti único para rotación (replay detection)
 */
export function generateTokenPair(userId) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', jti: uuidv4() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
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
 * Verifica rol mínimo requerido.
 * NOTA: El middleware de autenticación principal (authenticate / requireAuth)
 * está en src/middleware/auth.js. Usar siempre ese.
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role) && !roles.includes('*')) {
      return next(new AppError('No tienes permisos para esta acción', 403));
    }
    next();
  };
}
