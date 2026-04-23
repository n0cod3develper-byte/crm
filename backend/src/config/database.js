import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,                    // máximo de conexiones en el pool
  idleTimeoutMillis: 30000,   // cierra conexiones inactivas tras 30s
  connectionTimeoutMillis: 5000,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

// Verifica la conexión al iniciar
db.on('connect', () => {
  logger.debug('Nueva conexión establecida con PostgreSQL');
});

db.on('error', (err) => {
  logger.error('Error inesperado en el pool de PostgreSQL', { error: err.message });
});

/**
 * Helper para ejecutar queries con logging automático en desarrollo
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await db.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development' && duration > 100) {
      logger.warn('Query lenta detectada', { duration, text: text.substring(0, 80) });
    }
    return result;
  } catch (err) {
    logger.error('Error en query SQL', { error: err.message, text: text.substring(0, 80) });
    throw err;
  }
}

/**
 * Ejecuta una función dentro de una transacción.
 * Si la función lanza un error, hace rollback automáticamente.
 */
export async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkConnection() {
  try {
    await db.query('SELECT 1');
    logger.info('✅ Conexión a PostgreSQL establecida');
    return true;
  } catch (err) {
    logger.error('❌ No se pudo conectar a PostgreSQL', { error: err.message });
    return false;
  }
}
