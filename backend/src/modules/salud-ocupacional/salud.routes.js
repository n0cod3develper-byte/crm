import { Router } from 'express';
import { saludController } from './salud.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Examenes
router.get('/:empleadoId/examenes', saludController.getExamenes);
router.post('/:empleadoId/examenes', saludController.createExamen);
router.delete('/examenes/:id', saludController.deleteExamen);

// Restricciones
router.get('/:empleadoId/restricciones', saludController.getRestricciones);
router.post('/:empleadoId/restricciones', saludController.createRestriccion);
router.patch('/restricciones/:id', saludController.updateRestriccion);
router.delete('/restricciones/:id', saludController.deleteRestriccion);

// EPP
router.get('/:empleadoId/epp', saludController.getEPP);
router.post('/:empleadoId/epp', saludController.createEPP);
router.delete('/epp/:id', saludController.deleteEPP);

// Accidentes
router.get('/:empleadoId/accidentes', saludController.getAccidentes);
router.post('/:empleadoId/accidentes', saludController.createAccidente);
router.delete('/accidentes/:id', saludController.deleteAccidente);

export default router;
