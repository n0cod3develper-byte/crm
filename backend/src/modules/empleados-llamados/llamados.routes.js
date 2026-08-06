import { Router } from 'express';
import { llamadosController } from './llamados.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ─── CRUD Llamados y Felicitaciones por Empleado ──
router.get('/empleado/:empleadoId', llamadosController.listarPorEmpleado);
router.get('/:id', llamadosController.obtener);
router.post('/', llamadosController.crear);
router.patch('/:id', llamadosController.actualizar);
router.delete('/:id', llamadosController.eliminar);

export default router;
