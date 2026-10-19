import { Router } from 'express';
import { leadsController } from './leads.controller.js';
import { authenticate, verificarPermiso } from '../../middleware/auth.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
  asignablesQuerySchema,
} from './leads.schema.js';
import { leadsHistoryController } from './leadsHistory.controller.js';
import { historyQuerySchema } from './leadsHistory.schema.js';

const router = Router();

router.use(authenticate);

// ─── Rutas nominales (ANTES de /:id para que Express no las capture) ────
// GET /api/v1/leads/asignables — empleados activos para el select "Asignado a".
// Devuelve solo id y nombre: jamás salario, EPS, ARL ni documento.
router.get('/asignables',
  validateQuery(asignablesQuerySchema),
  verificarPermiso('leads', 'ver'),
  leadsController.asignables);

// ─── CRUD ──────────────────────────────────────────────────────────────
router.get('/',
  validateQuery(listLeadsQuerySchema),
  verificarPermiso('leads', 'ver'),
  leadsController.list);

router.post('/',
  validate(createLeadSchema),
  verificarPermiso('leads', 'crear'),
  leadsController.create);

router.get('/:id',
  verificarPermiso('leads', 'ver'),
  leadsController.get);

// ─── Historial / Trazabilidad (SOLO LECTURA) ──────────────────────────
// No existe ningún endpoint de escritura o borrado del historial: por diseño
// los usuarios comunes no pueden modificarlo ni eliminarlo.
router.get('/:id/history',
  validateQuery(historyQuerySchema),
  verificarPermiso('leads', 'ver'),
  leadsHistoryController.history);

router.get('/:id/summary',
  verificarPermiso('leads', 'ver'),
  leadsHistoryController.summary);

router.patch('/:id',
  validate(updateLeadSchema),
  verificarPermiso('leads', 'editar'),
  leadsController.update);

router.patch('/:id/convert',
  verificarPermiso('leads', 'editar'),
  leadsController.convert);

router.delete('/:id',
  verificarPermiso('leads', 'eliminar'),
  leadsController.remove);

export default router;
