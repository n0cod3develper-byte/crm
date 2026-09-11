import { Router } from 'express';
import { busquedaGlobal } from './busquedaGlobal.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { searchLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.get('/', requireAuth, searchLimiter, busquedaGlobal);

export default router;
