/**
 * horasExtras.controller.js
 */

import { HorasExtrasRepository } from './horasExtras.repository.js';
import { calcularYGuardarJornada, calcularDesdeRemision, sincronizarHistoricoRemisiones } from './horasExtras.service.js';
import { logger } from '../../utils/logger.js';

const repo = new HorasExtrasRepository();

export const horasExtrasController = {
  // ─── Configuración ────────────────────────────────────────

  async getConfiguracion(req, res, next) {
    try {
      const data = await repo.getConfiguracion();
      res.json(data);
    } catch (error) {
      logger.error('Error en getConfiguracion', { error: error.message });
      next(error);
    }
  },

  async updateConfiguracion(req, res, next) {
    try {
      const updated = await repo.updateConfiguracion(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Configuración no encontrada' });
      res.json(updated);
    } catch (error) {
      logger.error('Error en updateConfiguracion', { error: error.message });
      next(error);
    }
  },

  // ─── Festivos ─────────────────────────────────────────────

  async getFestivos(req, res, next) {
    try {
      const { anio } = req.query;
      const data = await repo.getFestivos(anio ? parseInt(anio) : null);
      res.json(data);
    } catch (error) {
      logger.error('Error en getFestivos', { error: error.message });
      next(error);
    }
  },

  // ─── Jornadas Laborales Puras ─────────────────────────────

  async crearJornadaManual(req, res, next) {
    try {
      const result = await calcularYGuardarJornada(req.body);
      res.json({ ok: true, data: result });
    } catch (error) {
      logger.error('Error en crearJornadaManual', { error: error.message });
      next(error);
    }
  },

  async deleteJornada(req, res, next) {
    try {
      const { id } = req.params;
      const result = await repo.deleteJornada(id);
      if (!result) return res.status(404).json({ error: 'Jornada no encontrada' });
      res.json({ ok: true, data: result });
    } catch (error) {
      logger.error('Error en deleteJornada', { error: error.message });
      next(error);
    }
  },

  async updateObservacion(req, res, next) {
    try {
      const { id } = req.params;
      const { observacion } = req.body;
      const result = await repo.updateObservacion(id, observacion);
      res.json({ ok: true, data: result });
    } catch (error) {
      logger.error('Error en updateObservacion', { error: error.message });
      next(error);
    }
  },

  // ─── Legacy / Remisiones Fallback ──────────────────────────

  async calcularDesdeRemision(req, res, next) {
    try {
      const resultados = await calcularDesdeRemision(req.params.remision_id);
      res.json({ ok: true, resultados });
    } catch (error) {
      logger.error('Error en calcularDesdeRemision', { error: error.message });
      next(error);
    }
  },

  async sincronizarHistorico(req, res, next) {
    try {
      const { forzar } = req.body || {};
      const resultado = await sincronizarHistoricoRemisiones({ forzarTodos: Boolean(forzar) });
      res.json({ ok: true, data: resultado });
    } catch (error) {
      logger.error('Error en sincronizarHistorico', { error: error.message });
      next(error);
    }
  },

  // ─── Consultas y Reportes ─────────────────────────────────

  async getDetalle(req, res, next) {
    try {
      const data = await repo.getDetalleJornada(req.params.jornada_id);
      res.json(data);
    } catch (error) {
      logger.error('Error en getDetalle', { error: error.message });
      next(error);
    }
  },

  async getResumenAgrupado(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin, operario_id } = req.query;
      const data = await repo.getResumenAgrupado({ fecha_inicio, fecha_fin, operario_id });
      res.json(data);
    } catch (error) {
      logger.error('Error en getResumenAgrupado', { error: error.message });
      next(error);
    }
  },

  async getInformeGestionHumana(req, res, next) {
    try {
      const { fecha_inicio, fecha_fin, operario_id, page, limit } = req.query;
      const result = await repo.getInformeGestionHumana({ fecha_inicio, fecha_fin, operario_id, page, limit });
      
      // Si el resultado tiene paginación (page/limit fueron proporcionados)
      if (result && result.pagination) {
        res.json({
          data: result.rows,
          pagination: result.pagination,
          totals: result.totals,
        });
      } else {
        // Sin paginación (exportación Excel) — devuelve array plano
        res.json(result);
      }
    } catch (error) {
      logger.error('Error en getInformeGestionHumana', { error: error.message });
      next(error);
    }
  },

  async getOperarios(req, res, next) {
    try {
      const { tipo } = req.query;
      const data = await repo.getOperariosConJornadas(tipo);
      res.json(data);
    } catch (error) {
      logger.error('Error en getOperarios', { error: error.message });
      next(error);
    }
  }
};
