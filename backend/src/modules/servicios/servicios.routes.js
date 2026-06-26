import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { serviciosController } from './servicios.controller.js';

const router = Router();
router.use(requireAuth);

// Rutas especiales (antes de /:id para no colisionar)
router.get('/operarios-disponibles', serviciosController.getOperariosDisponibles);
router.get('/last-forma-pago/:company_id', serviciosController.getLastFormaPago);
router.get('/last-horometro/:equipo_id', serviciosController.getLastHorometro);

router.get('/',    serviciosController.list);
router.post('/',   serviciosController.create);
router.get('/:id', serviciosController.get);
router.put('/:id', serviciosController.update);
router.delete('/:id', serviciosController.remove);

// PDF
router.get('/:id/pdf', serviciosController.downloadPDF);

// Operarios de la remisión
router.post('/:id/operarios',        serviciosController.addOperario);
router.delete('/:id/operarios/:oid', serviciosController.removeOperario);

// ─── Liquidación de Horas Laborales ─────────────────────────────
router.get('/:id/horas-laborales',        serviciosController.getHorasLaborales);
router.post('/:id/horas-laborales',       serviciosController.upsertHorasLaborales);
router.delete('/:id/horas-laborales/:hid', serviciosController.deleteHorasLaborales);

// ─── Registro de Días (Servicio Fijo) ─────────────────────────────
router.get('/:id/dias-fijo',            serviciosController.getDiasFijo);
router.post('/:id/dias-fijo',           serviciosController.upsertDiaFijo);
router.delete('/:id/dias-fijo/:did',    serviciosController.deleteDiaFijo);

export default router;
