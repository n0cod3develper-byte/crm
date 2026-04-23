import { Router } from 'express';
import passport from 'passport';
import { authController } from './auth.controller.js';
import { authenticate } from '../../utils/jwt.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { env } from '../../config/env.js';

const router = Router();

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
router.post('/logout', authenticate, authController.logout);

// ─── Perfil ──────────────────────────────────────────────────
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, authController.updateProfile);

export default router;
