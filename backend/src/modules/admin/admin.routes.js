import { Router } from 'express';
import { requireAuth, soloAdmin } from '../../middleware/auth.js';
import * as adminController from './admin.controller.js';

const router = Router();

// Rutas de administración (solo Admin)

router.get('/usuarios', requireAuth, soloAdmin, adminController.listarUsuarios);
router.post('/usuarios/invitar', requireAuth, soloAdmin, adminController.invitarUsuario);
router.patch('/usuarios/:id/rol', requireAuth, soloAdmin, adminController.cambiarRolUsuario);
router.patch('/usuarios/:id/password', requireAuth, soloAdmin, adminController.cambiarClaveUsuario);

// Ruta para el usuario actual (usada al cargar la app)
router.get('/permisos', requireAuth, adminController.miInformacion);
// Rutas de administración de módulos (solo Admin)
router.get('/modulos', requireAuth, soloAdmin, adminController.listarModulos);
router.post('/modulos', requireAuth, soloAdmin, adminController.crearModulo);
router.put('/modulos/:id', requireAuth, soloAdmin, adminController.actualizarModulo);
router.delete('/modulos/:id', requireAuth, soloAdmin, adminController.eliminarModulo);

export default router;
