import { Router } from 'express';
import { requireAuth, soloAdmin } from '../../middleware/auth.js';
import * as adminController from './admin.controller.js';

const router = Router();

// Rutas de administración (solo Admin)
router.get('/roles', requireAuth, soloAdmin, adminController.listarRoles);
router.get('/roles/:id', requireAuth, soloAdmin, adminController.obtenerDetalleRol);
router.put('/roles/:id/permisos', requireAuth, soloAdmin, adminController.actualizarPermisosRol);

router.get('/usuarios', requireAuth, soloAdmin, adminController.listarUsuarios);
router.post('/usuarios/invitar', requireAuth, soloAdmin, adminController.invitarUsuario);
router.patch('/usuarios/:id/rol', requireAuth, soloAdmin, adminController.cambiarRolUsuario);
router.patch('/usuarios/:id/activar', requireAuth, soloAdmin, adminController.activarDesactivarUsuario);
router.patch('/usuarios/:id/password', requireAuth, soloAdmin, adminController.cambiarPasswordAdmin);

// Ruta para el usuario actual (usada al cargar la app)
router.get('/permisos', requireAuth, adminController.miInformacion);

export default router;
