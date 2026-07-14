import { TasksService } from './tasks.service.js';
import { TasksHistoryRepository } from './tasks-history.repository.js';
import { NotFoundError } from '../../utils/errors.js';
import { query } from '../../config/database.js';

const service = new TasksService();
const historyRepo = new TasksHistoryRepository();

export const tasksController = {
  async list(req, res, next) {
    try {
      const { assignedTo, status, relatedType, relatedId, search, limit, cursor, dateFilter, priorityFilter, userFilter, favorite } = req.query;
      const result = await service.listTasks({ 
        assignedTo, status, relatedType, relatedId, search, limit: parseInt(limit) || 50, cursor,
        userId: req.user.id,
        userRole: req.user.role
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async getAssignableUsers(req, res, next) {
    try {
      const sql = `SELECT id, nombre, apellido, email, avatar_url FROM users WHERE estado = 'ACTIVO' ORDER BY nombre ASC`;
      const result = await query(sql);
      res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const task = await service.getTask(req.params.id);
      res.json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const task = await service.createTask(req.body, req.user.id);
      res.status(201).json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const task = await service.updateTask(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async complete(req, res, next) {
    try {
      const task = await service.completeTask(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await service.deleteTask(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, message: 'Tarea eliminada' });
    } catch (err) { next(err); }
  },

  async getHistory(req, res, next) {
    try {
      const history = await historyRepo.getHistoryByTaskId(req.params.id);
      res.json({ success: true, data: history });
    } catch (err) { next(err); }
  },

  async getExpiring(req, res, next) {
    try {
      const data = await service.getExpiringTasks(req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
};

