import { EquiposRepository } from './equipos.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

const repo = new EquiposRepository();

export const equiposController = {
  async list(req, res, next) {
    try {
      const { empresa_id, motor, combustible, capacidad_carga, search, limit, cursor } = req.query;
      const result = await repo.findAll({ 
        empresa_id, motor, combustible, capacidad_carga, search, 
        limit: parseInt(limit) || 50, cursor 
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const equipo = await repo.findById(req.params.id);
      if (!equipo) throw new NotFoundError('Equipo');
      res.json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { serial } = req.body;
      const existing = await repo.findBySerial(serial);
      if (existing) throw new BadRequestError(`El serial ${serial} ya está registrado`);
      
      const equipo = await repo.create(req.body);
      res.status(201).json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { serial } = req.body;
      
      if (serial) {
        const existing = await repo.findBySerial(serial);
        if (existing && existing.id !== id) throw new BadRequestError(`El serial ${serial} ya está registrado`);
      }

      const equipo = await repo.update(id, req.body);
      if (!equipo) throw new NotFoundError('Equipo');
      res.json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.softDelete(req.params.id);
      if (!result) throw new NotFoundError('Equipo');
      res.json({ success: true, message: 'Equipo eliminado correclamente' });
    } catch (err) { next(err); }
  },

  async listByCompany(req, res, next) {
    try {
      const equipos = await repo.findByCompany(req.params.id);
      res.json({ success: true, data: equipos });
    } catch (err) { next(err); }
  }
};
