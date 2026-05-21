import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      logger.debug('Validation failed', { path: req.path, errors });
      return res.status(422).json({
        success: false,
        error: 'Error de validacion',
        details: errors,
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      logger.debug('Query validation failed', { path: req.path, errors });
      return res.status(422).json({
        success: false,
        error: 'Error de validacion en parametros',
        details: errors,
      });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      logger.debug('Params validation failed', { path: req.path, errors });
      return res.status(422).json({
        success: false,
        error: 'Error de validacion en parametros de ruta',
        details: errors,
      });
    }
    req.params = result.data;
    next();
  };
}

function formatZodErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
