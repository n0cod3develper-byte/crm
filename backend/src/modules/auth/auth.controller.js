import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateTokenPair } from '../../utils/jwt.js';
import { query } from '../../config/database.js';
import { redis, isRedisAvailable } from '../../config/redis.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { obtenerPermisosUsuario } from '../../middleware/auth.js';
import { setAuthCookies, clearAuthCookies, getRefreshToken, parseMaxAge } from '../../utils/cookies.js';

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
      throw new AppError('Credenciales inválidas', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const { accessToken, refreshToken } = generateTokenPair(user.id);

    // Actualizar último acceso
    await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    delete user.password_hash;

    // Establecer cookies httpOnly (seguro contra XSS)
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      data: {
        user
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

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Usuario registrado correctamente'
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
  try {
    const token = getAccessToken(req);
    if (token && redis && redis.status === 'ready') {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await redis.set(`bl_${token}`, 'revoked', 'EX', expiresIn);
        }
      }
    }
    clearAuthCookies(res);
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (err) {
    clearAuthCookies(res);
    res.json({ success: true, message: 'Sesión cerrada (con errores menores)' });
  }
}

async function refreshToken(req, res, next) {
  try {
    const token = getRefreshToken(req);
    if (!token) throw new AppError('Refresh token requerido', 400);

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Refresh token inválido o expirado', 401);
    }

    if (payload.type !== 'refresh') throw new AppError('Tipo de token incorrecto', 401);

    // ─── Refresh Token Rotation ─────────────────────────────────
    // Verificar que el refresh token no haya sido usado antes (replay detection)
    if (isRedisAvailable()) {
      const tokenJti = payload.jti || token;
      const isReplayed = await redis.get(`refresh:used:${tokenJti}`);
      if (isReplayed) {
        // Posible robo de token — invalidar todos los refresh tokens del usuario
        logger.warn('Posible robo de refresh token detectado', { userId: payload.sub });
        await redis.del(`refresh:family:${payload.sub}`);
        clearAuthCookies(res);
        throw new AppError('Sesión expirada — inicie sesión nuevamente', 401);
      }

      // Marcar este token como usado (tiempo de vida igual al refresh token)
      const ttlMs = parseMaxAge(env.JWT_REFRESH_EXPIRES_IN);
      await redis.set(`refresh:used:${tokenJti}`, '1', 'PX', ttlMs);
    }

    // Generar nuevo par con nuevo jti
    const tokens = generateTokenPair(payload.sub);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { nombre, apellido } = req.body;
    const result = await query(
      `UPDATE users SET
        nombre  = COALESCE($1, nombre),
        apellido = COALESCE($2, apellido),
        updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, nombre, apellido, avatar_url`,
      [nombre || null, apellido || null, req.userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('La contraseña actual y la nueva son requeridas', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('La nueva contraseña debe tener al menos 6 caracteres', 400);
    }

    // Verificar contraseña actual
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    if (user.password_hash) {
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        throw new AppError('La contraseña actual no es correcta', 400);
      }
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, req.userId]
    );

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No se recibió la imagen', 400);
    }

    const file = req.file;
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new AppError('Formato no permitido. Usa JPG, PNG, WebP o GIF', 400);
    }

    const { guardarArchivo } = await import('../../services/fileStorageService.js');
    const metadata = await guardarArchivo(file.path, 'avatars', file.originalname);

    // Construir URL pública
    const baseUrl = env.API_BASE_URL || `http://localhost:${env.PORT}`;
    const avatarUrl = `${baseUrl}/uploads/${metadata.rutaRelativa}`;

    // Actualizar usuario
    const result = await query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, nombre, apellido, avatar_url`,
      [avatarUrl, req.userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function oauthCallback(req, res) {
  const user = req.user;
  const { accessToken, refreshToken } = generateTokenPair(user.id);

  await query(
    `UPDATE users SET updated_at = NOW() WHERE id = $1`,
    [user.id]
  );

  // Establecer cookies httpOnly en lugar de pasar tokens por URL
  setAuthCookies(res, accessToken, refreshToken);

  logger.info('Usuario autenticado via OAuth', { userId: user.id, email: user.email });

  // Redirigir sin tokens en la URL
  const redirectUrl = new URL('/auth/callback', env.FRONTEND_URL);
  res.redirect(redirectUrl.toString());
}

export const authController = {
  login,
  register,
  me,
  logout,
  refreshToken,
  updateProfile,
  changePassword,
  uploadProfilePhoto,
  oauthCallback
};
