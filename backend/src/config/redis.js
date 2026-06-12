import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisAvailable = false;

// ─── Cliente BullMQ (ioredis) — para colas de trabajos ─────────
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,   // requerido por BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

redisConnection.on('connect', () => logger.info('✅ Conectado a Redis (BullMQ)'));
redisConnection.on('error', (err) => logger.error('Error Redis BullMQ', { error: err.message }));

// ─── Cliente general (ioredis) — para caché de IA, sessions, etc. ──
export const redis = new IORedis(env.REDIS_URL, {
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      logger.warn('Redis no disponible después de 3 reintentos — continuando sin Redis');
      return null; // dejar de reintentar
    }
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  if (!redisAvailable) return; // No spamear logs si nunca se conectó
  logger.error('Error Redis general', { error: err.message });
});

redis.on('ready', () => {
  redisAvailable = true;
  logger.info('✅ Conectado a Redis (caché general)');
});

redis.on('end', () => {
  redisAvailable = false;
});

/**
 * Indica si Redis está disponible
 */
export function isRedisAvailable() {
  return redisAvailable && redis.status === 'ready';
}

/**
 * Conectar a Redis — no falla si Redis no está disponible
 */
export async function connectRedis() {
  try {
    await redis.connect();
    redisAvailable = true;
    logger.info('✅ Conectado a Redis (caché general)');
  } catch (err) {
    redisAvailable = false;
    logger.warn('⚠️  Redis no disponible — el servidor continuará sin Redis', { error: err.message });
    logger.warn('   Funcionalidades como refresh token rotation y caché estarán deshabilitadas');
  }
}

/**
 * Helpers de caché con TTL automático — graceful fallback si Redis no disponible
 */
export const cache = {
  async get(key) {
    if (!isRedisAvailable()) return null;
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 3600) {
    if (!isRedisAvailable()) return;
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Silenciar error — la caché es opcional
    }
  },

  async del(key) {
    if (!isRedisAvailable()) return;
    try {
      await redis.del(key);
    } catch {
      // Silenciar error
    }
  },

  async delPattern(pattern) {
    if (!isRedisAvailable()) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // Silenciar error
    }
  },
};
