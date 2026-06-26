import { Router } from 'express';
import { requireAuth, soloAdmin } from '../../middleware/auth.js';
import * as rolesController from './roles.controller.js';

const router = Router();

// Todas las rutas requieren autenticación + rol de administrador
router.use(requireAuth, soloAdmin);

// ─── Rutas estáticas primero (para evitar conflictos con :id) ──
router.get('/modulos', rolesController.listarModulos);

// ─── CRUD de Roles ──────────────────────────────────────────────
router.get('/',    rolesController.listarRoles);
router.post('/',   rolesController.crearRol);
router.get('/:id', rolesController.obtenerRol);
router.put('/:id', rolesController.actualizarRol);
router.delete('/:id', rolesController.eliminarRol);

// ─── Permisos ───────────────────────────────────────────────────
router.put('/:id/permisos', rolesController.actualizarPermisos);
router.put('/:id/permisos/:modulo/:accion', rolesController.togglePermisoIndividual);

export default router;
