import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

/**
 * Rate limiter general — 100 req/min por IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Demasiadas solicitudes. Intenta en 1 minuto.', 429));
  },
});

/**
 * Rate limiter estricto para endpoints de autenticación — 10 req/min por IP
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, _res, next) => {
    next(new AppError('Demasiados intentos de autenticación. Espera 1 minuto.', 429));
  },
});

/**
 * Rate limiter para webhooks externos (WhatsApp, Asterisk) — más permisivo
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
