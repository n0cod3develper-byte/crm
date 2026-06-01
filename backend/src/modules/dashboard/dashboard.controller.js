import { DashboardRepository } from './dashboard.repository.js';

const repo = new DashboardRepository();

export const dashboardController = {
  async getKpis(req, res, next) {
    try {
      const data = await repo.getKpis();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
