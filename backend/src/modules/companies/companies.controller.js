import { CompaniesRepository } from './companies.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new CompaniesRepository();

export const companiesController = {
  async list(req, res, next) {
    try {
      const { search, assignedTo, tags, limit, cursor } = req.query;
      const result = await repo.findAll({
        search,
        assignedTo,
        tags: tags ? tags.split(',') : undefined,
        limit: parseInt(limit) || 20,
        cursor,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const company = await repo.findById(req.params.id);
      if (!company) throw new NotFoundError('Empresa');
      res.json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const company = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const company = await repo.update(req.params.id, req.body);
      if (!company) throw new NotFoundError('Empresa');
      res.json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.softDelete(req.params.id);
      if (!result) throw new NotFoundError('Empresa');
      res.json({ success: true, message: 'Empresa eliminada correctamente' });
    } catch (err) { next(err); }
  },

  async timeline(req, res, next) {
    try {
      const { limit } = req.query;
      const items = await repo.getTimeline(req.params.id, parseInt(limit) || 30);
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  },
};
