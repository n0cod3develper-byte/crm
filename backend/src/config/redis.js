import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// ─── Estado de disponibilidad ─────────────────────────────────
let redisAvailable = false;

// ─── Cliente BullMQ (ioredis) — para colas de trabajos ───────
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,   // requerido por BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null; // No reintentar indefinidamente
    return Math.min(times * 500, 2000);
  },
});

redisConnection.on('connect', () => logger.info('✅ Conectado a Redis (BullMQ)'));
redisConnection.on('error', (err) => logger.warn('Redis BullMQ no disponible', { error: err.message }));

// ─── Cliente general (ioredis) — para caché ───────────────────
export const redis = new IORedis(env.REDIS_URL, {
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
});

redis.on('error', (err) => logger.warn('Redis general no disponible', { error: err.message }));

/**
 * Intenta conectar a Redis. Si falla, el backend continúa sin caché.
 */
export async function connectRedis() {
  try {
    // ioredis se conecta automáticamente, pero esperamos a que esté listo
    if (redis.status === 'ready') {
      redisAvailable = true;
      logger.info('✅ Conectado a Redis (caché general)');
      return;
    }
    await new Promise((resolve, reject) => {
      redis.once('ready', () => {
        redisAvailable = true;
        logger.info('✅ Conectado a Redis (caché general)');
        resolve();
      });
      redis.once('error', reject);
    });
  } catch (err) {
    redisAvailable = false;
    logger.warn('⚠️  Redis no disponible — el sistema funcionará sin caché.', {
      error: err.message,
    });
  }
} // ← cierre de connectRedis

/**
 * Helpers de caché con TTL automático.
 * Si Redis no está disponible, las operaciones son no-ops silenciosas.
 */
export const cache = {
  async get(key) {
    if (!redisAvailable) return null;
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 3600) {
    if (!redisAvailable) return;
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // silencioso
    }
  },

  async del(key) {
    if (!redisAvailable) return;
    try {
      await redis.del(key);
    } catch {
      // silencioso
    }
  },

  async delPattern(pattern) {
    if (!redisAvailable) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // silencioso
    }
  },
};
