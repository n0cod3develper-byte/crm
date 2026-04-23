import { Router } from 'express';
import { employeesController } from './employees.controller.js';
import { authenticate } from '../../utils/jwt.js';

const router = Router();

// Todas las rutas de empleados requieren autenticación
router.use(authenticate);

router.get('/',      employeesController.list);
router.post('/',     employeesController.create);
router.get('/:id',   employeesController.get);
router.patch('/:id', employeesController.update);
router.delete('/:id', employeesController.remove);

export default router;
