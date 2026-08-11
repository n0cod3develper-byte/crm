import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { informesController } from './informes.controller.js';
import mantenimientoRoutes from './informes-mantenimiento.routes.js';

const router = Router();
router.use(requireAuth);

router.get('/servicios/ventas-linea-negocio', informesController.getVentasPorLineaNegocio);
router.get('/servicios/ventas-mensuales', informesController.getVentasMensuales);
router.get('/servicios/ventas-equipos', informesController.getVentasPorEquipo);
router.get('/servicios/sales-vs-budget', informesController.getSalesVsBudget);

// Rutas usadas por InformesServiciosPage (nuevos gráficos)
router.get('/servicios/ventas-por-equipo', informesController.getVentasPorEquipoV2);
router.get('/servicios/ventas-por-linea', informesController.getVentasPorLineaV2);
router.get('/servicios/ventas-vs-presupuesto', informesController.getVentasVsPresupuestoV2);
router.get('/servicios/top-clientes', informesController.getTop10Clientes);

// KPI: Horas trabajadas
router.get('/kpi/hours-by-equipment', informesController.getHoursByEquipment);
router.get('/kpi/hours-by-equipment/:equipment_id', informesController.getHoursByEquipmentDetail);
router.get('/kpi/hours-by-operator', informesController.getHoursByOperator);
router.get('/kpi/hours-by-operator/:operator_id', informesController.getHoursByOperatorDetail);

// Gestión Humana
router.get('/gestion-humana/liquidacion-bonificacion', informesController.getLiquidacionBonificacion);
router.get('/gestion-humana/liquidacion-ajustes', informesController.getLiquidacionAjustes);
router.put('/gestion-humana/liquidacion-ajustes', informesController.upsertLiquidacionAjustes);

// Horas Extras
router.get('/horas-extras/servicios', informesController.getHorasExtrasServicios);

// Mantenimiento
router.use('/mantenimiento', mantenimientoRoutes);

// Email Marketing Reports
router.get('/email-marketing/resumen',             informesController.getEmailDashboardResumen);
router.get('/email-marketing/tasas-campana',        informesController.getEmailTasasPorCampana);
router.get('/email-marketing/evolucion-listas',     informesController.getEmailEvolucionListas);
router.get('/email-marketing/ranking-plantillas',   informesController.getEmailRankingPlantillas);
router.get('/email-marketing/salud-lista',          informesController.getEmailSaludLista);
router.get('/email-marketing/comparativo-campanas', informesController.getEmailComparativoCampanas);
router.get('/email-marketing/evolucion-mensual',     informesController.getEmailEvolucionMensual);

export default router;
