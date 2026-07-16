import { informesRepository } from './informes.repository.js';
import { logger } from '../../utils/logger.js';

export const informesController = {
  async getVentasPorLineaNegocio(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getVentasPorLineaNegocio(fecha_inicio, fecha_fin);
      res.json(data);
    } catch (error) {
      logger.error('Error en getVentasPorLineaNegocio', { error: error.message });
      next(error);
    }
  },

  async getVentasMensuales(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getVentasMensuales(fecha_inicio, fecha_fin);
      res.json({ data });
    } catch (error) {
      logger.error('Error en getVentasMensuales', { error: error.message });
      next(error);
    }
  },

  async getVentasPorEquipo(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getVentasPorEquipo(fecha_inicio, fecha_fin);
      res.json(data);
    } catch (error) {
      logger.error('Error en getVentasPorEquipo', { error: error.message });
      next(error);
    }
  },

  async getSalesVsBudget(req, res, next) {
    try {
      const { equipment_id, date_from, date_to } = req.query;
      if (!equipment_id) return res.status(400).json({ error: 'equipment_id es requerido' });
      const data = await informesRepository.getSalesVsBudget(equipment_id, date_from, date_to);
      res.json(data);
    } catch (error) {
      logger.error('Error en getSalesVsBudget', { error: error.message });
      next(error);
    }
  },

  // ── KPI: Hours by Equipment ──
  async getHoursByEquipment(req, res, next) {
    try {
      const { date_from, date_to } = req.query;
      const data = await informesRepository.getHoursByEquipment(date_from, date_to);
      res.json(data);
    } catch (error) {
      logger.error('Error en getHoursByEquipment', { error: error.message });
      next(error);
    }
  },

  async getHoursByEquipmentDetail(req, res, next) {
    try {
      const { equipment_id } = req.params;
      const { date_from, date_to } = req.query;
      if (!equipment_id) return res.status(400).json({ error: 'equipment_id es requerido' });
      const data = await informesRepository.getHoursByEquipmentDetail(equipment_id, date_from, date_to);
      res.json(data);
    } catch (error) {
      logger.error('Error en getHoursByEquipmentDetail', { error: error.message });
      next(error);
    }
  },

  // ── KPI: Hours by Operator ──
  async getHoursByOperator(req, res, next) {
    try {
      const { date_from, date_to } = req.query;
      const data = await informesRepository.getHoursByOperator(date_from, date_to);
      res.json(data);
    } catch (error) {
      logger.error('Error en getHoursByOperator', { error: error.message });
      next(error);
    }
  },

  async getHoursByOperatorDetail(req, res, next) {
    try {
      const { operator_id } = req.params;
      const { date_from, date_to } = req.query;
      if (!operator_id) return res.status(400).json({ error: 'operator_id es requerido' });
      const data = await informesRepository.getHoursByOperatorDetail(operator_id, date_from, date_to);
      res.json(data);
    } catch (error) {
      logger.error('Error en getHoursByOperatorDetail', { error: error.message });
      next(error);
    }
  },

  // ── GESTIÓN HUMANA: Liquidación Bonificación por Horas ──
  async getLiquidacionBonificacion(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridos' });
      }

      // Calcular período de quincena anterior automáticamente
      const d1 = new Date(fecha_inicio + 'T00:00:00');
      const d2 = new Date(fecha_fin + 'T00:00:00');
      let prevInicio, prevFin;

      if (d1.getDate() === 1 && d2.getDate() === 15) {
        // Quincena 1 actual (1-15) → anterior: 16-último del mes anterior
        const mesAnterior = new Date(d1.getFullYear(), d1.getMonth() - 1, 1);
        const ultimoDia = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0).getDate();
        const mStr = String(mesAnterior.getMonth() + 1).padStart(2, '0');
        prevInicio = `${mesAnterior.getFullYear()}-${mStr}-16`;
        prevFin    = `${mesAnterior.getFullYear()}-${mStr}-${ultimoDia}`;
      } else {
        // Quincena 2 actual (16-fin) → anterior: 1-15 del mismo mes
        const mStr = String(d1.getMonth() + 1).padStart(2, '0');
        prevInicio = `${d1.getFullYear()}-${mStr}-01`;
        prevFin    = `${d1.getFullYear()}-${mStr}-15`;
      }

      const [principal, anterior] = await Promise.all([
        informesRepository.getLiquidacionBonificacion(fecha_inicio, fecha_fin),
        informesRepository.getLiquidacionBonificacionPorOperario(prevInicio, prevFin),
      ]);

      res.json({
        ...principal,
        quincena_anterior: {
          fecha_inicio: prevInicio,
          fecha_fin:    prevFin,
          por_operario: anterior,
        },
      });
    } catch (error) {
      logger.error('Error en getLiquidacionBonificacion', { error: error.message });
      next(error);
    }
  },

  async getTop10Clientes(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getTop10Clientes(fecha_inicio, fecha_fin);
      res.json({ data });
    } catch (error) {
      logger.error('Error en getTop10Clientes', { error: error.message });
      next(error);
    }
  },

  // ── Nuevos endpoints para InformesServiciosPage ──

  async getVentasPorEquipoV2(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const rows = await informesRepository.getVentasPorEquipo(fecha_inicio, fecha_fin);
      // Adaptar campo equipo_nombre → nombre
      const data = rows.map(r => ({ nombre: r.equipo_nombre, total_ventas: parseFloat(r.total_ventas || 0) }));
      res.json({ data });
    } catch (error) {
      logger.error('Error en getVentasPorEquipoV2', { error: error.message });
      next(error);
    }
  },

  async getVentasPorLineaV2(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const rows = await informesRepository.getVentasPorLineaNegocio(fecha_inicio, fecha_fin);
      // Adaptar campo linea_negocio → nombre
      const data = rows.map(r => ({ nombre: r.linea_negocio, total_ventas: parseFloat(r.total_ventas || 0) }));
      res.json({ data });
    } catch (error) {
      logger.error('Error en getVentasPorLineaV2', { error: error.message });
      next(error);
    }
  },

  async getVentasVsPresupuestoV2(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const rows = await informesRepository.getVentasVsPresupuestoSimple(fecha_inicio, fecha_fin);
      res.json({ data: rows });
    } catch (error) {
      logger.error('Error en getVentasVsPresupuestoV2', { error: error.message });
      next(error);
    }
  },

  // ── MANTENIMIENTO: Órdenes por Estado ──
  async getOrdenesPorEstado(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getOrdenesPorEstado(fecha_inicio, fecha_fin);
      res.json({ data });
    } catch (error) {
      logger.error('Error en getOrdenesPorEstado', { error: error.message });
      next(error);
    }
  },

  // ── MANTENIMIENTO: Equipos con más Mantenimientos ──
  async getEquiposMasMantenimientos(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getEquiposMasMantenimientos(fecha_inicio, fecha_fin);
      res.json({ data });
    } catch (error) {
      logger.error('Error en getEquiposMasMantenimientos', { error: error.message });
      next(error);
    }
  },

  // ── MANTENIMIENTO: Distribución por Tipo de Mantenimiento ──
  async getTipoMantenimiento(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin } = req.query;
      const data = await informesRepository.getTipoMantenimiento(fecha_inicio, fecha_fin);
      res.json({ data });
    } catch (error) {
      logger.error('Error en getTipoMantenimiento', { error: error.message });
      next(error);
    }
  },
};
