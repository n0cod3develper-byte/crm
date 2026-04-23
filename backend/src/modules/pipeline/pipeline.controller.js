import { PipelineRepository } from './pipeline.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new PipelineRepository();

export const pipelineController = {
  async listStages(req, res, next) {
    try {
      const stages = await repo.findAllStages();
      res.json({ success: true, data: stages });
    } catch (err) { next(err); }
  },

  async createStage(req, res, next) {
    try {
      const stage = await repo.createStage(req.body);
      res.status(201).json({ success: true, data: stage });
    } catch (err) { next(err); }
  },

  async updateStage(req, res, next) {
    try {
      const stage = await repo.updateStage(req.params.id, req.body);
      if (!stage) throw new NotFoundError('Etapa');
      res.json({ success: true, data: stage });
    } catch (err) { next(err); }
  },
};
