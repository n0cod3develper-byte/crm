import { InventoryRepository } from './inventory.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new InventoryRepository();

/**
 * Map legacy frontend field names to current DB column names.
 * After migration 019, unit_cost → costo_reposicion, stock_current → stock_actual.
 */
function mapFrontendFields(body) {
  const data = { ...body };
  if ('unit_cost' in data) {
    data.costo_reposicion = data.unit_cost;
    delete data.unit_cost;
  }
  if ('stock_current' in data) {
    data.stock_actual = data.stock_current;
    delete data.stock_current;
  }
  return data;
}

export const inventoryController = {
  async list(req, res, next) {
    try {
      const { area, category, search, isActive, limit, cursor } = req.query;
      const result = await repo.findAll({ area, category, search, isActive, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async search(req, res, next) {
    try {
      const q = req.query.q || '';
      const result = await repo.findAll({ search: q, limit: 20 });
      res.json({ success: true, data: result.data });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) throw new NotFoundError('Item de inventario');
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async getAvailability(req, res, next) {
    try {
      const availability = await repo.getAvailability(req.params.id);
      if (!availability) throw new NotFoundError('Item de inventario');
      res.json({ success: true, data: availability });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const item = await repo.create(mapFrontendFields(req.body));
      res.status(201).json({ success: true, data: item });
    } catch (err) { 
      if (err.code === '23505') { // unique violation (SKU)
        return res.status(400).json({ success: false, error: { message: 'El SKU ya existe' } });
      }
      next(err); 
    }
  },

  async update(req, res, next) {
    try {
      const item = await repo.update(req.params.id, mapFrontendFields(req.body));
      if (!item) throw new NotFoundError('Item de inventario');
      res.json({ success: true, data: item });
    } catch (err) { 
      if (err.code === '23505') {
        return res.status(400).json({ success: false, error: { message: 'El SKU ya existe' } });
      }
      next(err); 
    }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Item de inventario');
      res.json({ success: true, message: 'Item eliminado del inventario' });
    } catch (err) { next(err); }
  },
};
