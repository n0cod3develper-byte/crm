import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { informesController } from './informes.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/servicios/ventas-linea-negocio', informesController.getVentasPorLineaNegocio);
router.get('/servicios/ventas-mensuales', informesController.getVentasMensuales);
router.get('/servicios/ventas-equipos', informesController.getVentasPorEquipo);
router.get('/servicios/sales-vs-budget', informesController.getSalesVsBudget);

// KPI: Horas trabajadas
router.get('/kpi/hours-by-equipment', informesController.getHoursByEquipment);
router.get('/kpi/hours-by-equipment/:equipment_id', informesController.getHoursByEquipmentDetail);
router.get('/kpi/hours-by-operator', informesController.getHoursByOperator);
router.get('/kpi/hours-by-operator/:operator_id', informesController.getHoursByOperatorDetail);

// Gestión Humana
router.get('/gestion-humana/liquidacion-bonificacion', informesController.getLiquidacionBonificacion);

export default router;
