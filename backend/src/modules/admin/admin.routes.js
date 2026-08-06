import { Router } from 'express';
import { requireAuth, soloAdmin } from '../../middleware/auth.js';
import * as adminController from './admin.controller.js';
import * as auditController from './auditLog.controller.js';

const router = Router();

// ─── Auditoría (solo Admin) ─────────────────────────────────
router.get('/auditoria',       requireAuth, soloAdmin, auditController.listarLogs);
router.get('/auditoria/stats', requireAuth, soloAdmin, auditController.obtenerEstadisticas);
router.get('/auditoria/modulos', requireAuth, soloAdmin, auditController.obtenerModulos);
router.get('/auditoria/export',  requireAuth, soloAdmin, auditController.exportarLogs);
router.get('/auditoria/:id',   requireAuth, soloAdmin, auditController.obtenerLog);

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
