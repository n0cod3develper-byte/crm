import { Router } from 'express';
import { resetPasswordController } from './resetPassword.controller.js';
import { resetPasswordLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

const forgotSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido')
});

const resetSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma la contraseña')
});

const router = Router();

// ─── Forgot Password ──────────────────────────────────────────
router.post('/forgot-password',
  resetPasswordLimiter,
  validate(forgotSchema),
  resetPasswordController.forgotPassword
);

// ─── Validate Token (GET) ─────────────────────────────────────
router.get('/reset-password/validate/:token',
  resetPasswordController.validateResetTokenEndpoint
);

// ─── Reset Password (POST) ────────────────────────────────────
// No se aplica resetPasswordLimiter aquí: el endpoint requiere un token válido,
// lo cual ya es protección suficiente. Rate limiting excesivo bloquearía
// usuarios legítimos que escriben mal su nueva contraseña.
router.post('/reset-password',
  validate(resetSchema),
  resetPasswordController.resetPassword
);

export default router;
