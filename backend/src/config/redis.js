import { createClient } from 'redis';
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

// ─── Cliente general (node-redis) — para caché ───────────────
export const redis = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) return new Error('Redis connection failed');
      return Math.min(retries * 100, 1000);
    },
    connectTimeout: 5000
  }
});

redis.on('error', (err) => logger.warn('Redis general no disponible', { error: err.message }));

/**
 * Intenta conectar a Redis. Si falla, el backend continúa sin caché.
 */
export async function connectRedis() {
  try {
    await redis.connect();
    redisAvailable = true;
    logger.info('✅ Conectado a Redis (caché general)');
  } catch (err) {
    redisAvailable = false;
    logger.warn('⚠️  Redis no disponible — el sistema funcionará sin caché. Inicia Redis para habilitar caché.', {
      error: err.message,
    });
  }
}

/**
 * Helpers de caché con TTL automático.
 * Si Redis no está disponible, las operaciones son no-ops silenciosas.
 */
export const cache = {
  async get(key) {
    if (!redisAvailable || !redis.isOpen) return null;
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 3600) {
    if (!redisAvailable || !redis.isOpen) return;
    try {
      await redis.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // silencioso
    }
  },

  async del(key) {
    if (!redisAvailable || !redis.isOpen) return;
    try {
      await redis.del(key);
    } catch {
      // silencioso
    }
  },

  async delPattern(pattern) {
    if (!redisAvailable || !redis.isOpen) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(keys);
    } catch {
      // silencioso
    }
  },
};
