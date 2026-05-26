import { ReportsRepository } from './reports.repository.js';
import { BadRequestError } from '../../utils/errors.js';

const repo = new ReportsRepository();

export const reportsController = {
  async getServiciosSales(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;

      if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
        throw new BadRequestError('La fecha de inicio no puede ser posterior a la fecha de fin');
      }

      const data = await repo.findServiciosSales(fecha_desde, fecha_hasta);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getMantenimientoSales(req, res, next) {
    try {
      const { fecha_desde, fecha_hasta } = req.query;

      if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
        throw new BadRequestError('La fecha de inicio no puede ser posterior a la fecha de fin');
      }

      const data = await repo.findMantenimientoSales(fecha_desde, fecha_hasta);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
};
