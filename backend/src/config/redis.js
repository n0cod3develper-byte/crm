import { createClient } from 'redis';
import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Cliente BullMQ (ioredis) — para colas de trabajos
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,   // requerido por BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

redisConnection.on('connect', () => logger.info('✅ Conectado a Redis (BullMQ)'));
redisConnection.on('error', (err) => logger.error('Error Redis BullMQ', { error: err.message }));

// Cliente general (node-redis) — para caché de IA, sessions, etc.
export const redis = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => logger.error('Error Redis general', { error: err.message }));

export async function connectRedis() {
  await redis.connect();
  logger.info('✅ Conectado a Redis (caché general)');
}

/**
 * Helpers de caché con TTL automático
 */
export const cache = {
  async get(key) {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  },

  async set(key, value, ttlSeconds = 3600) {
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  },

  async del(key) {
    await redis.del(key);
  },

  async delPattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(keys);
  },
};
