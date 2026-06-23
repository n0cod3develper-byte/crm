import { Router } from 'express';
import passport from 'passport';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter, uploadLimiter } from '../../middleware/rateLimiter.js';
import { uploadSingle } from '../../config/storage.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

const registerSchema = z.object({
  nombre: z.string().min(2),
  apellido: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const router = Router();

// ─── Local Auth ──────────────────────────────────────────────
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// ─── Google OAuth ────────────────────────────────────────────
router.get('/google',
  authLimiter,
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
  authController.oauthCallback
);

// ─── Microsoft OAuth ─────────────────────────────────────────
router.get('/microsoft',
  authLimiter,
  passport.authenticate('microsoft', { session: false })
);

router.get('/microsoft/callback',
  passport.authenticate('microsoft', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
  authController.oauthCallback
);

// ─── Token management ────────────────────────────────────────
router.post('/refresh', authLimiter, authController.refreshToken);
router.post('/logout', requireAuth, authController.logout);

// ─── Perfil ──────────────────────────────────────────────────
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, authController.updateProfile);
router.post('/me/password', requireAuth, authLimiter, authController.changePassword);
router.post('/me/foto', requireAuth, uploadLimiter, uploadSingle, authController.uploadProfilePhoto);

export default router;
