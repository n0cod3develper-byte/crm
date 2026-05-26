import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) return null;
  return crypto.createHash('sha256').update(rawKey).digest();
}

export function encryptToken(plaintext) {
  if (!plaintext) return plaintext;
  
  const key = getEncryptionKey();
  if (!key) {
    logger.debug('OAUTH_TOKEN_ENCRYPTION_KEY no configurada — tokens OAuth se almacenarán en texto plano');
    return plaintext;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return `${encrypted}:${iv.toString('hex')}:${tag}`;
  } catch (err) {
    logger.error('Error encriptando token OAuth', { error: err.message });
    throw new Error('Error al encriptar token OAuth');
  }
}

export function decryptToken(encryptedText) {
  if (!encryptedText) return encryptedText;

  if (!encryptedText.includes(':')) {
    return encryptedText;
  }

  const key = getEncryptionKey();
  if (!key) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      logger.warn('Formato de token encriptado inválido');
      return encryptedText;
    }

    const [encrypted, ivHex, tagHex] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error('Error desencriptando token OAuth', { error: err.message });
    return encryptedText;
  }
}
