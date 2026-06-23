import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { promptSpecsController } from './promptSpecs.controller.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

const router = Router();

// ─── Validacion Zod ────────────────────────────────────────
const createSchema = z.object({
  nombreModulo: z.string().min(1, 'nombreModulo es requerido'),
  area: z.string().min(1, 'area es requerido'),
  objetivo: z.string().min(1, 'objetivo es requerido'),
  entidades: z.string().optional().nullable(),
  reglasNegocio: z.string().optional().nullable(),
  relaciones: z.array(z.string()).optional().default([]),
  datosSensibles: z.boolean().optional().default(false),
  requiereUI: z.boolean().optional().default(true),
  notasExtra: z.string().optional().nullable(),
  clonadoDe: z.number().int().positive().optional().nullable(),
});

// ─── Middleware de autorizacion personalizado ───────────────
function requireAdminOrDev(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const role = req.user.role;
  if (role === 'admin' || role === 'developer') {
    return next();
  }
  return res.status(403).json({ error: 'No tienes permisos para acceder a este modulo.' });
}

// ─── Todas las rutas requieren autenticacion + rol ─────────
router.use(requireAuth);
router.use(requireAdminOrDev);

// ─── Endpoints ──────────────────────────────────────────────
router.get('/modulos', promptSpecsController.getModulos);
router.get('/', promptSpecsController.list);
router.get('/:id', promptSpecsController.getById);
router.post('/', validate(createSchema), promptSpecsController.create);
router.post('/:id/clonar', promptSpecsController.clone);
router.delete('/:id', promptSpecsController.remove);

export default router;
