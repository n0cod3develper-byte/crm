import { Router } from 'express';
import { employeesController } from './employees.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Todas las rutas de empleados requieren autenticación
router.use(authenticate);

// ─── Rutas nominales (ANTES de /:id para evitar que Express las capture como parámetro) ─
// GET  /api/v1/employees/usuarios-disponibles
router.get('/usuarios-disponibles', employeesController.listUsuariosDisponibles);

// ─── CRUD ──────────────────────────────────────────────────
router.get('/',      employeesController.list);
router.post('/bulk', employeesController.bulkCreate);
router.post('/',     employeesController.create);
router.get('/:id',   employeesController.get);
router.patch('/:id', employeesController.update);
router.delete('/:id', employeesController.remove);

// ─── Vinculación con usuarios (por :id) ────────────────────
// GET  /api/v1/employees/:id/usuarios
router.get('/:id/usuarios', employeesController.listUsuariosParaEmpleado);

export default router;
