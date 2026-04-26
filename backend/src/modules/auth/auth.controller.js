import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateTokenPair } from '../../utils/jwt.js';
import { query } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { obtenerPermisosUsuario } from '../../middleware/auth.js';

/**
 * Login de usuario
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email y contraseña son requeridos', 400);
    }

    const result = await query(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.password_hash, u.estado, r.slug as role 
       FROM users u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user || user.estado !== 'ACTIVO') {
      throw new AppError('Credenciales inválidas o usuario inactivo', 401);
    }

    if (!user.password_hash) {
      throw new AppError('Este usuario no tiene una contraseña configurada', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const { accessToken, refreshToken } = generateTokenPair(user.id);

    // Actualizar último acceso
    await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    delete user.password_hash;

    res.json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Registro de usuario (vía invitación)
 */
async function register(req, res, next) {
  try {
    const { token, password, nombre, apellido } = req.body;

    if (!token || !password) {
      throw new AppError('Token y contraseña son requeridos', 400);
    }

    // Validar token
    const result = await query(
      `SELECT id FROM users 
       WHERE invitation_token = $1 AND invitation_expires > NOW() AND estado = 'ACTIVO'`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Token de invitación inválido o expirado', 400);
    }

    const userId = result.rows[0].id;

    // Encriptar password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Actualizar usuario
    await query(
      `UPDATE users SET 
        password_hash = $1, 
        nombre = COALESCE($2, nombre),
        apellido = COALESCE($3, apellido),
        invitation_token = NULL,
        invitation_expires = NULL,
        updated_at = NOW()
       WHERE id = $4`,
      [passwordHash, nombre, apellido, userId]
    );

    const { accessToken, refreshToken } = generateTokenPair(userId);

    res.json({
      success: true,
      message: 'Usuario registrado correctamente',
      data: { accessToken, refreshToken }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener perfil del usuario actual
 */
async function me(req, res, next) {
  try {
    const userId = req.userId;
    
    const userResult = await query(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.avatar_url, u.estado, r.slug as rol_slug, r.nombre as rol_nombre
       FROM users u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    const user = userResult.rows[0];
    if (!user) throw new AppError('Usuario no encontrado', 404);

    const permisos = await obtenerPermisosUsuario(userId);

    res.json({
      ...user,
      ...permisos
    });
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
    const { nombre, apellido, avatar_url } = req.body;
    const result = await query(
      `UPDATE users SET
        nombre  = COALESCE($1, nombre),
        apellido = COALESCE($2, apellido),
        avatar_url = COALESCE($3, avatar_url),
        updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, nombre, apellido, avatar_url`,
      [nombre || null, apellido || null, avatar_url || null, req.userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function oauthCallback(req, res) {
  const user = req.user;
  const { accessToken, refreshToken } = generateTokenPair(user.id);

  // Persiste el refresh token en BD
  await query(
    `UPDATE users SET updated_at = NOW() WHERE id = $1`,
    [user.id]
  );

  const redirectUrl = new URL('/auth/callback', env.FRONTEND_URL);
  redirectUrl.searchParams.set('token', accessToken);
  redirectUrl.searchParams.set('refresh', refreshToken);

  logger.info('Usuario autenticado via OAuth', { userId: user.id, email: user.email });
  res.redirect(redirectUrl.toString());
}

export const authController = {
  login,
  register,
  me,
  logout,
  refreshToken,
  updateProfile,
  oauthCallback
};
