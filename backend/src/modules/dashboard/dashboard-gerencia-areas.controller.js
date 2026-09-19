import { DashboardGerenciaAreasRepository } from './dashboard-gerencia-areas.repository.js';
import { logger } from '../../utils/logger.js';

const repo = new DashboardGerenciaAreasRepository();

export const dashboardGerenciaAreasController = {
  /**
   * GET /api/v1/dashboard/gerencia/mantenimiento
   * KPIs del área de Mantenimiento.
   */
  async getMantenimiento(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getMantenimiento({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en dashboard gerencia mantenimiento', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/dashboard/gerencia/gestion-humana
   * KPIs del área de Gestión Humana.
   */
  async getGestionHumana(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getGestionHumana({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en dashboard gerencia gestión humana', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/dashboard/gerencia/bienestar
   * KPIs del área de Bienestar (ausentismo, accidentalidad).
   */
  async getBienestar(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getBienestar({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en dashboard gerencia bienestar', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/dashboard/gerencia/servicios/presupuesto
   * KPIs de Presupuesto para Servicios (ventas vs presupuesto).
   */
  async getPresupuestoServicios(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getPresupuestoServicios({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en dashboard gerencia presupuesto servicios', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/dashboard/gerencia/mantenimiento/presupuesto
   * KPIs de Presupuesto para Mantenimiento (costo vs presupuesto).
   */
  async getPresupuestoMantenimiento(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getPresupuestoMantenimiento({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en dashboard gerencia presupuesto mantenimiento', { error: err.message });
      next(err);
    }
  },
};
