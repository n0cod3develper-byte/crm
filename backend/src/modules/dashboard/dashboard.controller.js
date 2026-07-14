import { DashboardRepository } from './dashboard.repository.js';

const repo = new DashboardRepository();

export const dashboardController = {
  async getKpis(req, res, next) {
    try {
      const data = await repo.getKpis(req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
