import { EmployeesRepository } from './employees.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new EmployeesRepository();

export const employeesController = {
  async list(req, res, next) {
    try {
      const { position, status, search, limit, cursor } = req.query;
      const result = await repo.findAll({ position, status, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const employee = await repo.findById(req.params.id);
      if (!employee) throw new NotFoundError('Empleado');
      res.json({ success: true, data: employee });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const employee = await repo.create(req.body);
      res.status(201).json({ success: true, data: employee });
    } catch (err) { next(err); }
  },

  async bulkCreate(req, res, next) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ success: false, message: 'Se esperaba un arreglo de empleados' });
      }
      const employees = await repo.bulkCreate(req.body);
      res.status(201).json({ success: true, count: employees.length, data: employees });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const employee = await repo.update(req.params.id, req.body);
      if (!employee) throw new NotFoundError('Empleado');
      res.json({ success: true, data: employee });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Empleado');
      res.json({ success: true, message: 'Empleado eliminado' });
    } catch (err) { next(err); }
  },
};
