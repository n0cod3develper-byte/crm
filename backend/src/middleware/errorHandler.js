import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Middleware centralizado de manejo de errores.
 * Debe ser el último middleware registrado en Express.
 */
export function errorHandler(err, req, res, _next) {
  // Error operacional (AppError) — responder al cliente
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Errores de PostgreSQL conocidos
  if (err.code === '23505') {   // unique_violation
    return res.status(409).json({
      success: false,
      error: { message: 'Ya existe un registro con esos datos', code: 'DUPLICATE' },
    });
  }
  if (err.code === '23503') {   // foreign_key_violation
    logger.error('FK violation', { detail: err.detail, constraint: err.constraint, table: err.table });
    return res.status(400).json({
      success: false,
      error: { message: `Referencia a recurso inexistente: ${err.detail || err.constraint || ''}`, code: 'FK_VIOLATION' },
    });
  }

  // Error inesperado — loguear y no exponer detalles al cliente
  logger.error('Error no manejado', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  import('fs').then(fs => fs.appendFileSync('last_error.log', new Date().toISOString() + '\\n' + err.message + '\\n' + err.stack + '\\n\\n'));

  res.status(500).json({
    success: false,
    error: {
      message: env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err.message,
    },
  });
}

/**
 * Middleware para rutas no encontradas (404)
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Ruta ${req.method} ${req.url} no existe` },
  });
}
