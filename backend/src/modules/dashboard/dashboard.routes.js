import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { dashboardController } from './dashboard.controller.js';

const router = Router();

router.use(authenticate);

router.get('/kpis', dashboardController.getKpis);

export default router;
