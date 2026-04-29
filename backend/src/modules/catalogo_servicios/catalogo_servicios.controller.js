import { CatalogoServiciosRepository } from './catalogo_servicios.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

const repo = new CatalogoServiciosRepository();

export const catalogoServiciosController = {
  async list(req, res, next) {
    try {
      const { search, is_active, limit } = req.query;
      const data = await repo.findAll({ search, is_active, limit: parseInt(limit) || 100 });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) throw new NotFoundError('Servicio del catálogo');
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { nombre } = req.body;
      if (!nombre) throw new BadRequestError('nombre es requerido');
      const item = await repo.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const item = await repo.update(req.params.id, req.body);
      if (!item) throw new NotFoundError('Servicio del catálogo');
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Servicio del catálogo');
      res.json({ success: true, message: 'Servicio eliminado correctamente' });
    } catch (err) { next(err); }
  },
};
