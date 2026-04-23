import { TasksRepository } from './tasks.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new TasksRepository();

export const tasksController = {
  async list(req, res, next) {
    try {
      const { assignedTo, status, relatedType, relatedId, search, limit, cursor } = req.query;
      const result = await repo.findAll({ assignedTo, status, relatedType, relatedId, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const task = await repo.findById(req.params.id);
      if (!task) throw new NotFoundError('Tarea');
      res.json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const task = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const task = await repo.update(req.params.id, req.body);
      if (!task) throw new NotFoundError('Tarea');
      res.json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async complete(req, res, next) {
    try {
      const task = await repo.complete(req.params.id);
      if (!task) throw new NotFoundError('Tarea');
      res.json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Tarea');
      res.json({ success: true, message: 'Tarea eliminada' });
    } catch (err) { next(err); }
  },
};
