import { Router } from 'express';
import passport from 'passport';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { env } from '../../config/env.js';

const router = Router();

// ─── Local Auth ──────────────────────────────────────────────
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

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

export default router;
