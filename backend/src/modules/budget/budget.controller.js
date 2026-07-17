import { budgetRepository } from './budget.repository.js';
import { logger } from '../../utils/logger.js';

export const budgetController = {
  async getAreas(req, res, next) {
    try {
      const areas = await budgetRepository.getAreas();
      res.json(areas);
    } catch (error) {
      next(error);
    }
  },

  async createArea(req, res, next) {
    try {
      const area = await budgetRepository.createArea(req.body);
      res.status(201).json(area);
    } catch (error) {
      next(error);
    }
  },

  async getAnnualBudget(req, res, next) {
    try {
      const { area_id, year } = req.query;
      if (!area_id || !year) {
        return res.status(400).json({ error: 'area_id y year son requeridos' });
      }
      const budget = await budgetRepository.getAnnualBudget(area_id, year);
      res.json(budget || { area_id, year, total_amount: 0 }); // Devolver objeto vacío si no existe
    } catch (error) {
      next(error);
    }
  },

  async upsertAnnualBudget(req, res, next) {
    try {
      const budget = await budgetRepository.upsertAnnualBudget(req.body);
      res.json(budget);
    } catch (error) {
      next(error);
    }
  },

  async getEquipmentBudgets(req, res, next) {
    try {
      const { budget_annual_id } = req.query;
      if (!budget_annual_id) {
        return res.status(400).json({ error: 'budget_annual_id es requerido' });
      }
      const equipmentBudgets = await budgetRepository.getEquipmentBudgets(budget_annual_id);
      
      // Adjuntar los detalles mensuales a cada equipo para facilitar el frontend
      for (let eq of equipmentBudgets) {
        eq.monthly_details = await budgetRepository.getEquipmentMonthlyDetails(eq.id);
      }
      
      res.json(equipmentBudgets);
    } catch (error) {
      next(error);
    }
  },

  async upsertEquipmentBudget(req, res, next) {
    try {
      // Validar que la suma mensual no supere el total anual
      // (Esta validación se hace normalmente en frontend, pero por seguridad en backend)
      const equipmentBudget = await budgetRepository.upsertEquipmentBudget(req.body);
      res.json(equipmentBudget);
    } catch (error) {
      logger.error('Error upserting equipment budget', { error: error.message });
      next(error);
    }
  },

  async deleteEquipmentBudget(req, res, next) {
    try {
      const { id } = req.params;
      await budgetRepository.deleteEquipmentBudget(id);
      res.json({ success: true, id });
    } catch (error) {
      next(error);
    }
  },

  async getEquipmentMonthlyDetails(req, res, next) {
    try {
      const { id } = req.params; // budget_equipment_id
      const details = await budgetRepository.getEquipmentMonthlyDetails(id);
      res.json(details);
    } catch (error) {
      next(error);
    }
  },

  // ══════════════════════════════════════════════════════
  // ÁREA 1 — MANTENIMIENTO: Líneas de Negocio
  // ══════════════════════════════════════════════════════

  /** GET /budget/business-lines — catálogo de líneas de negocio */
  async getBusinessLines(req, res, next) {
    try {
      const lines = await budgetRepository.getBusinessLines();
      res.json({ success: true, data: lines });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /budget/mantenimiento?year=2025
   * Retorna el presupuesto mensual de todas las líneas para el año dado.
   */
  async getMantenimientoPresupuesto(req, res, next) {
    try {
      const { year } = req.query;
      if (!year) {
        return res.status(400).json({ error: 'El parámetro year es obligatorio' });
      }
      const yearInt = parseInt(year);
      if (isNaN(yearInt) || yearInt < 2020 || yearInt > 2099) {
        return res.status(400).json({ error: 'El año debe estar entre 2020 y 2099' });
      }
      const rows = await budgetRepository.getMantenimientoPresupuesto(yearInt);
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /budget/mantenimiento
   * Body: { year, rows: [{ linea_negocio_id, month, amount }] }
   * Guarda todos los valores de la tabla en una transacción.
   */
  async upsertMantenimientoPresupuesto(req, res, next) {
    try {
      const { year, rows } = req.body;

      if (!year || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Se requiere year y rows[]' });
      }

      const yearInt = parseInt(year);
      if (isNaN(yearInt) || yearInt < 2020 || yearInt > 2099) {
        return res.status(400).json({ error: 'El año debe estar entre 2020 y 2099' });
      }

      // Validar cada fila antes de persistir
      for (const row of rows) {
        const { linea_negocio_id, month, amount } = row;
        if (!linea_negocio_id || !month || amount === undefined || amount === null) {
          return res.status(400).json({ error: 'Cada fila requiere linea_negocio_id, month y amount' });
        }
        const monthInt = parseInt(month);
        if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
          return res.status(400).json({ error: `Mes inválido: ${month}` });
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum < 0) {
          return res.status(400).json({ error: `El monto no puede ser negativo (mes ${month})` });
        }
      }

      const payload = rows.map(r => ({
        linea_negocio_id: parseInt(r.linea_negocio_id),
        year: yearInt,
        month: parseInt(r.month),
        amount: parseFloat(r.amount),
      }));

      const result = await budgetRepository.upsertMantenimientoPresupuestoBulk(payload);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error guardando presupuesto de mantenimiento', { error: error.message });
      next(error);
    }
  },
};
