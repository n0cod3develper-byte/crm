import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { dashboardGerenciaLimiter } from '../../middleware/rateLimiter.js';
import { dashboardController } from './dashboard.controller.js';
import { dashboardGerenciaController } from './dashboard-gerencia.controller.js';
import { dashboardGerenciaAreasController } from './dashboard-gerencia-areas.controller.js';

const router = Router();

router.use(authenticate);

router.get('/kpis', dashboardController.getKpis);

// ─── Dashboard Gerencial ──────────────────────────────────────
// Doble protección: authorize() verifica rol 'gerencia' (o admin bypass)
// + dashboardGerenciaLimiter para queries agregadas costosas.
// NUNCA confiar solo en el frontend para ocultar el menú.
router.get(
  '/gerencia',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaController.getKpis,
);
router.get(
  '/gerencia/cartera-detalle',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaController.getCarteraDetalle,
);
router.get(
  '/gerencia/pendientes-detalle',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaController.getPendientesDetalle,
);

// ─── Pestañas de áreas del Dashboard Gerencial ──────────────
// Cada pestaña carga sus KPIs de forma independiente (lazy loading).
router.get(
  '/gerencia/mantenimiento',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaAreasController.getMantenimiento,
);
router.get(
  '/gerencia/gestion-humana',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaAreasController.getGestionHumana,
);
router.get(
  '/gerencia/bienestar',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaAreasController.getBienestar,
);

// ─── Presupuesto vs Real (por pestaña de área) ─────────────
router.get(
  '/gerencia/servicios/presupuesto',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaAreasController.getPresupuestoServicios,
);
router.get(
  '/gerencia/mantenimiento/presupuesto',
  authorize('gerencia'),
  dashboardGerenciaLimiter,
  dashboardGerenciaAreasController.getPresupuestoMantenimiento,
);

export default router;
