import { Router } from 'express';
import { authenticate } from '../../utils/jwt.js';
import { serviciosController } from './servicios.controller.js';

const router = Router();
router.use(authenticate);

// Rutas especiales (antes de /:id para no colisionar)
router.get('/operarios-disponibles', serviciosController.getOperariosDisponibles);
router.get('/last-forma-pago/:company_id', serviciosController.getLastFormaPago);

router.get('/',    serviciosController.list);
router.post('/',   serviciosController.create);
router.get('/:id', serviciosController.get);
router.put('/:id', serviciosController.update);
router.delete('/:id', serviciosController.remove);

// PDF
router.get('/:id/pdf', serviciosController.downloadPDF);

// Operarios de la remisión
router.post('/:id/operarios',       serviciosController.addOperario);
router.delete('/:id/operarios/:oid', serviciosController.removeOperario);

export default router;
