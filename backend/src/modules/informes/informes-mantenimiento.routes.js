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

// ── NUEVOS KPIs Avanzados ──
// MTTR: Tiempo Medio de Reparación
router.get('/mttr', informesController.getMTTRMantenimiento);

// MTBF: Tiempo Medio Entre Fallas
router.get('/mtbf', informesController.getMTBFMantenimiento);

// Preventivos próximos a vencer (próximos N días, default=15)
router.get('/preventivos-proximos', informesController.getPreventivosProximos);

// Stock bajo vinculado a OTs activas
router.get('/stock-bajo-activo', informesController.getStockBajoActivo);

// Indicadores de cobertura (equipos atendidos %, empresas activas, proveedores)
router.get('/cobertura', informesController.getCoberturaMantenimiento);

// Detalle de mantenimiento por equipos (informe tabular)
router.get('/detalle-equipos', informesController.getDetalleMantenimientoEquipos);

// Venta Dejada de Percibir por Indisponibilidad de Equipos
router.get('/venta-dejada-percibir', informesController.getVentaDejadaPercibir);

export default router;
