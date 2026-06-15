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
  }
};
