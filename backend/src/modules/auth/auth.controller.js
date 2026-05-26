import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateTokenPair } from '../../utils/jwt.js';
import { query } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { obtenerPermisosUsuario } from '../../middleware/auth.js';

/**
 * Login de usuario
 * Compatible con el esquema actual: users (full_name, role TEXT, is_active BOOLEAN)
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError('Email y contraseña son requeridos', 400);

    const result = await query(
      `SELECT id, email, full_name, role, is_active, password_hash, avatar_url
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) throw new AppError('Credenciales inválidas o usuario inactivo', 401);
    if (!user.password_hash) throw new AppError('Este usuario no tiene contraseña configurada', 401);

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new AppError('Credenciales inválidas', 401);

    const { accessToken, refreshToken } = generateTokenPair(user.id);
    await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    const { password_hash, ...safeUser } = user;

    res.json({
      success: true,
      data: { user: safeUser, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Registro por invitación
 */
async function register(req, res, next) {
  try {
    const { token, password, full_name } = req.body;
    if (!token || !password) throw new AppError('Token y contraseña son requeridos', 400);

    const result = await query(
      `SELECT id FROM users
       WHERE invitation_token = $1 AND invitation_expires > NOW() AND is_active = TRUE`,
      [token]
    );
    if (!result.rows[0]) throw new AppError('Token de invitación inválido o expirado', 400);

    const userId = result.rows[0].id;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await query(
      `UPDATE users SET
        password_hash = $1,
        full_name = COALESCE($2, full_name),
        invitation_token = NULL,
        invitation_expires = NULL,
        updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, full_name || null, userId]
    );

    const { accessToken, refreshToken } = generateTokenPair(userId);
    res.json({ success: true, message: 'Usuario registrado correctamente', data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
}

/**
 * Perfil del usuario autenticado
 */
async function me(req, res, next) {
  try {
    const userId = req.userId;
    const userResult = await query(
      `SELECT id, email, full_name, role, avatar_url, is_active FROM users WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new AppError('Usuario no encontrado', 404);

    // Obtiene permisos RBAC si existen; si no, devuelve vacíos
    let permisos = { rol: { slug: user.role, nombre: user.role }, permisos: {} };
    try {
      const rbac = await obtenerPermisosUsuario(userId);
      if (rbac && rbac.rol) permisos = rbac;
    } catch { /* RBAC no configurado — continúa sin permisos granulares */ }

    res.json({ ...user, ...permisos });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.json({ success: true, message: 'Sesión cerrada' });
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
    const tokens = generateTokenPair(payload.sub);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
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
       RETURNING id, email, full_name, role, avatar_url`,
      [full_name || null, avatar_url || null, req.userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function oauthCallback(req, res) {
  const user = req.user;
  const { accessToken, refreshToken } = generateTokenPair(user.id);
  await query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [user.id]);

  const redirectUrl = new URL('/auth/callback', env.FRONTEND_URL);
  redirectUrl.searchParams.set('token', accessToken);
  redirectUrl.searchParams.set('refresh', refreshToken);
  logger.info('Usuario autenticado via OAuth', { userId: user.id, email: user.email });
  res.redirect(redirectUrl.toString());
}

export const authController = { login, register, me, logout, refreshToken, updateProfile, oauthCallback };
