import { Router } from 'express';
import { authenticate, verificarPermiso, soloAdmin } from '../../middleware/auth.js';
import * as ctrl from './facturacion.controller.js';

const router = Router();
router.use(authenticate);

// ─── Consultas ───────────────────────────────────────────────
router.get('/ots-pendientes', verificarPermiso('facturacion', 'ver'), ctrl.getOtsPendientes);
router.get('/remisiones-pendientes', verificarPermiso('facturacion', 'ver'), ctrl.getRemisionesPendientes);
router.get('/cartera',         verificarPermiso('facturacion', 'ver'), ctrl.getResumenCartera);
router.get('/facturas',        verificarPermiso('facturacion', 'ver'), ctrl.getFacturas);
router.get('/facturas/:id',    verificarPermiso('facturacion', 'ver'), ctrl.getFactura);
router.get('/facturas/:id/pdf', verificarPermiso('facturacion', 'ver'), ctrl.downloadPDF);

// ─── Gestión ──────────────────────────────────────────────────
router.post('/prefacturas',     verificarPermiso('facturacion', 'crear'), ctrl.createPrefactura);
router.post('/prefacturas-remision', verificarPermiso('facturacion', 'crear'), ctrl.createPrefacturaFromRemisiones);
router.post('/facturas/:id/confirmar', verificarPermiso('facturacion', 'editar'), ctrl.confirmarFactura);
router.post('/facturas/:id/anular',    soloAdmin, ctrl.anularFactura);

export default router;
