import { SupplierQuotesRepository } from './supplier_quotes.repository.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const repo = new SupplierQuotesRepository();

export const supplierQuotesController = {
  async list(req, res, next) {
    try {
      const { companyId, proveedorId, status, search, limit, cursor } = req.query;
      const result = await repo.findAll({
        companyId,
        proveedorId,
        status,
        search,
        limit: parseInt(limit) || 50,
        cursor,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const quote = await repo.findById(req.params.id);
      if (!quote) throw new NotFoundError('Cotización a proveedor');
      res.json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const userId = req.user.id;
      const { proveedor_id, items } = req.body;
      
      // Validaciones obligatorias
      if (!proveedor_id) {
        return res.status(400).json({ success: false, message: 'El proveedor es obligatorio' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Debe agregar al menos un ítem' });
      }
      const invalidItem = items.find(it => !it.descripcion_manual && !it.item);
      if (invalidItem) {
        return res.status(400).json({ success: false, message: 'Todos los ítems deben tener una descripción' });
      }
      
      const created = await repo.create(req.body, userId);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { estado, ...rest } = req.body;
      const current = await repo.findById(id);
      if (!current) throw new NotFoundError('Cotización a proveedor');
      const isAdmin = req.user.roles?.includes('admin');
      
      let updateData = { ...rest };
      console.log('[SUPPLIER QUOTES] Update Data:', updateData);
      
      if (estado && estado !== current.estado) {
        if (estado === 'APROBADO') {
          // Only admin can approve
          if (!isAdmin) throw new ForbiddenError('Solo administradores pueden aprobar');
          await repo.calculateTotal(id);
          await repo.updateState(id, 'APROBADO');
          const provider = await repo.getProviderById(current.proveedor_id);
          if (provider?.razon_social === 'CARGAR S.A.S.') {
            await repo.adjustStockForQuote(id);
          }
          return res.json({ success: true, message: 'Cotización aprobada' });
        } else if (estado === 'ANULADO') {
          if (!isAdmin) throw new ForbiddenError('Solo administradores pueden anular');
          await repo.updateState(id, 'ANULADO');
          return res.json({ success: true, message: 'Cotización anulada' });
        } else {
          // For other states like CREADO
          updateData.estado = estado;
        }
      }
      console.log('[SUPPLIER QUOTES] Calling repo.update with:', updateData);
      const updated = await repo.update(id, updateData);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const quote = await repo.findById(id);
      if (!quote) throw new NotFoundError('Cotización a proveedor');
      if (quote.estado !== 'BORRADOR' && quote.estado !== 'CREADO') {
        throw new ForbiddenError('Solo se pueden eliminar cotizaciones en estado BORRADOR o CREADO');
      }
      await repo.delete(id);
      res.json({ success: true, message: 'Cotización eliminada' });
    } catch (err) {
      next(err);
    }
  },
};
