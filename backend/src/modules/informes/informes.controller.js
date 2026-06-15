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
      res.json(data);
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
  }
};
