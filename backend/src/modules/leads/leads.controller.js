import { LeadsRepository } from './leads.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new LeadsRepository();

export const leadsController = {
  async list(req, res, next) {
    try {
      const { status, assignedTo, source, campaignId, search, limit, cursor } = req.query;
      const result = await repo.findAll({ status, assignedTo, source, campaignId, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const lead = await repo.findById(req.params.id);
      if (!lead) throw new NotFoundError('Lead');
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const lead = await repo.create(req.body);
      res.status(201).json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const lead = await repo.update(req.params.id, req.body);
      if (!lead) throw new NotFoundError('Lead');
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async convert(req, res, next) {
    try {
      const result = await repo.convertToContact(req.params.id);
      if (!result) throw new NotFoundError('Lead no encontrado o ya convertido');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Lead');
      res.json({ success: true, message: 'Lead eliminado' });
    } catch (err) { next(err); }
  },
};
