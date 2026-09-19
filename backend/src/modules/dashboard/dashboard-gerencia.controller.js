import { DashboardGerenciaRepository } from './dashboard-gerencia.repository.js';
import { logger } from '../../utils/logger.js';

const repo = new DashboardGerenciaRepository();

export const dashboardGerenciaController = {
  /**
   * GET /api/v1/dashboard/gerencia
   * Retorna todos los KPIs del dashboard gerencial.
   * Query params opcionales: fecha_desde, fecha_hasta
   */
  async getKpis(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getKpis({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en dashboard gerencia KPIs', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/dashboard/gerencia/cartera-detalle?rango_min=0&rango_max=30
   * Detalle de facturas vencidas en un rango de antigüedad.
   */
  async getCarteraDetalle(req, res, next) {
    try {
      const rango_min = parseInt(req.query.rango_min);
      const rango_max = req.query.rango_max != null ? parseInt(req.query.rango_max) : null;
      if (isNaN(rango_min)) {
        return res.status(400).json({ error: 'rango_min es obligatorio' });
      }
      const data = await repo.getCarteraDetalle({ rango_min, rango_max });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en cartera detalle gerencia', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/dashboard/gerencia/pendientes-detalle?fecha_desde=...&fecha_hasta=...
   * Detalle de OTs y remisiones pendientes de facturar.
   */
  async getPendientesDetalle(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      const data = await repo.getPendientesDetalle({ fecha_desde, fecha_hasta });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Error en pendientes detalle gerencia', { error: err.message });
      next(err);
    }
  },
};
