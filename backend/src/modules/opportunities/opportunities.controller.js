import { OpportunitiesRepository } from './opportunities.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new OpportunitiesRepository();

export const opportunitiesController = {
  async list(req, res, next) {
    try {
      const { stageId, companyId, assignedTo, search, limit, cursor } = req.query;
      const result = await repo.findAll({ stageId, companyId, assignedTo, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const opp = await repo.findById(req.params.id);
      if (!opp) throw new NotFoundError('Oportunidad');
      res.json({ success: true, data: opp });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const opp = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: opp });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const opp = await repo.update(req.params.id, req.body);
      if (!opp) throw new NotFoundError('Oportunidad');
      res.json({ success: true, data: opp });
    } catch (err) { next(err); }
  },

  async moveStage(req, res, next) {
    try {
      const { stage_id, from_stage_id } = req.body;
      const opp = await repo.moveStage(req.params.id, stage_id, from_stage_id);
      if (!opp) throw new NotFoundError('Oportunidad');
      res.json({ success: true, data: opp });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.softDelete(req.params.id);
      if (!result) throw new NotFoundError('Oportunidad');
      res.json({ success: true, message: 'Oportunidad eliminada' });
    } catch (err) { next(err); }
  },

  async summary(req, res, next) {
    try {
      const data = await repo.summary();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
