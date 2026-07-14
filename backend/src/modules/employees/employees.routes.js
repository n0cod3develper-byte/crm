import { Router } from 'express';
import { employeesController } from './employees.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadSingle } from '../../config/storage.js';

const router = Router();

// Todas las rutas de empleados requieren autenticación
router.use(authenticate);

// ─── Rutas nominales (ANTES de /:id para evitar que Express las capture como parámetro) ─
// GET  /api/v1/employees/usuarios-disponibles
router.get('/usuarios-disponibles', employeesController.listUsuariosDisponibles);

// ─── CRUD ──────────────────────────────────────────────────
router.get('/',      employeesController.list);
router.post('/',     employeesController.create);
router.get('/:id',   employeesController.get);
router.patch('/:id', employeesController.update);
router.delete('/:id', employeesController.remove);

// ─── Vinculación con usuarios (por :id) ────────────────────
// GET  /api/v1/employees/:id/usuarios
router.get('/:id/usuarios', employeesController.listUsuariosParaEmpleado);

// ─── Historial Laboral ─────────────────────────────────────
router.get('/:id/historial', employeesController.getHistorial);
router.post('/:id/historial', employeesController.addHistorial);
router.delete('/:id/historial/:historialId', employeesController.removeHistorial);

// ─── Documentos ────────────────────────────────────────────
router.get('/:id/documentos', employeesController.getDocumentos);
router.post('/:id/documentos', uploadSingle, employeesController.addDocumento);
router.delete('/:id/documentos/:docId', employeesController.removeDocumento);

export default router;
