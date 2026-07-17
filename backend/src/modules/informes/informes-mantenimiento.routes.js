import { Router } from 'express';
import { informesController } from './informes.controller.js';

const router = Router();

// Órdenes de trabajo agrupadas por estado
router.get('/ordenes-por-estado', informesController.getOrdenesPorEstado);

// Top 10 equipos con más mantenimientos
router.get('/equipos-mas-mantenimientos', informesController.getEquiposMasMantenimientos);

// Distribución por tipo de mantenimiento (Correctivo / Preventivo)
router.get('/tipo-mantenimiento', informesController.getTipoMantenimiento);

// ── NUEVOS KPIs ──
// Ventas reales vs presupuesto
router.get('/ventas-vs-presupuesto', informesController.getVentasVsPresupuestoMantenimiento);

// Ventas reales vs presupuesto mensual (tendencia)
router.get('/ventas-vs-presupuesto-mensual', informesController.getVentasVsPresupuestoMensualMantenimiento);

// Horas laboradas por técnico
router.get('/horas-tecnicos', informesController.getHorasTecnicosMantenimiento);

// Disponibilidad de flota / downtime
router.get('/disponibilidad-flota', informesController.getDisponibilidadFlotaMantenimiento);

// Costo por Equipo
router.get('/costo-por-equipo', informesController.getCostoPorEquipoMantenimiento);

// Reincidencia de Fallas
router.get('/reincidencia-fallas', informesController.getReincidenciaFallasMantenimiento);

export default router;
