import { query } from '../../config/database.js';
import crypto from 'crypto';

/**
 * Hash SHA-256 de un token para almacenamiento seguro
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Genera un token criptográficamente seguro (64 hex chars = 32 bytes)
 */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Busca usuario por email y retorna info básica
 */
export async function findUserByEmail(email) {
  const result = await query(
    `SELECT id, email, nombre, estado FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

/**
 * Invalida tokens de reset anteriores (no usados) del usuario
 */
export async function invalidatePreviousTokens(userId) {
  await query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

/**
 * Crea un nuevo token de reset en la BD (almacena solo el hash)
 */
export async function createResetToken(userId, tokenPlain, expiresAt, ipAddress) {
  const tokenHash = hashToken(tokenPlain);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, expiresAt, ipAddress || null]
  );
}

/**
 * Valida un token: existe, no expirado, no usado
 * Retorna el user_id si es válido, null si no
 */
export async function validateResetToken(tokenPlain) {
  const tokenHash = hashToken(tokenPlain);
  const result = await query(
    `SELECT user_id, expires_at
     FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

/**
 * Marca un token como usado
 */
export async function markTokenUsed(tokenPlain) {
  const tokenHash = hashToken(tokenPlain);
  await query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL`,
    [tokenHash]
  );
}

/**
 * Actualiza la contraseña del usuario (bcrypt hash)
 */
export async function updatePassword(userId, passwordHash) {
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, userId]
  );
}

/**
 * Invalida todos los refresh tokens del usuario en Redis
 */
export async function invalidateAllSessions(userId, redis) {
  if (redis && redis.status === 'ready') {
    await redis.del(`refresh:family:${userId}`);
  }
}

/**
 * Elimina tokens expirados (mantenimiento, opcional)
 */
export async function cleanupExpiredTokens() {
  const result = await query(
    `DELETE FROM password_reset_tokens
     WHERE expires_at < NOW() - INTERVAL '7 days'
     OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days')`
  );
  return result.rowCount;
}
