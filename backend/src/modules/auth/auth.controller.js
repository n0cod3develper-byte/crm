import jwt from 'jsonwebtoken';
import { generateTokenPair } from '../../utils/jwt.js';
import { query } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Llamado después de que Passport completa el OAuth flow.
 * Genera tokens y redirige al frontend con el access token.
 */
async function oauthCallback(req, res) {
  const user = req.user;
  const { accessToken, refreshToken } = generateTokenPair(user.id);

  // Persiste el refresh token en BD
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [user.id]
  );

  // En un setup real se usaría una cookie HttpOnly para el refresh token.
  // Por simplicidad inicial lo pasamos via query param (el frontend lo guarda en memoria).
  const redirectUrl = new URL('/auth/callback', env.FRONTEND_URL);
  redirectUrl.searchParams.set('token', accessToken);
  redirectUrl.searchParams.set('refresh', refreshToken);

  logger.info('Usuario autenticado via OAuth', { userId: user.id, email: user.email });
  res.redirect(redirectUrl.toString());
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token requerido', 400);

    let payload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Refresh token inválido o expirado', 401);
    }

    if (payload.type !== 'refresh') throw new AppError('Tipo de token incorrecto', 401);

    const result = await query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) throw new AppError('Usuario no válido', 401);

    const tokens = generateTokenPair(user.id);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  // Con JWT stateless el logout es responsabilidad del cliente (eliminar tokens).
  // Si se implementa blacklist de refresh tokens, agregarla aquí.
  logger.info('Usuario cerró sesión', { userId: req.user.id });
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
}

async function me(req, res) {
  const result = await query(
    'SELECT id, email, full_name, avatar_url, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json({ success: true, data: result.rows[0] });
}

async function updateProfile(req, res, next) {
  try {
    const { full_name, avatar_url } = req.body;
    const result = await query(
      `UPDATE users SET
        full_name  = COALESCE($1, full_name),
        avatar_url = COALESCE($2, avatar_url),
        updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, full_name, avatar_url, role`,
      [full_name || null, avatar_url || null, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export const authController = {
  oauthCallback,
  refreshToken,
  logout,
  me,
  updateProfile,
};
