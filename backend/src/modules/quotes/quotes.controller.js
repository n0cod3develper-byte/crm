import { QuotesRepository } from './quotes.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new QuotesRepository();

export const quotesController = {
  async list(req, res, next) {
    try {
      const { companyId, opportunityId, status, search, limit, cursor } = req.query;
      const result = await repo.findAll({ companyId, opportunityId, status, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const quote = await repo.findById(req.params.id);
      if (!quote) throw new NotFoundError('Cotización');
      res.json({ success: true, data: quote });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const quote = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: quote });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const quote = await repo.update(req.params.id, req.body);
      if (!quote) throw new NotFoundError('Cotización');
      res.json({ success: true, data: quote });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Cotización');
      res.json({ success: true, message: 'Cotización eliminada' });
    } catch (err) { next(err); }
  },
};
