import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { reportsController } from './reports.controller.js';

const router = Router();
router.use(authenticate);

router.get('/servicios', reportsController.getServiciosSales);
router.get('/mantenimiento', reportsController.getMantenimientoSales);

export default router;
