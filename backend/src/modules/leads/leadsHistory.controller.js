import { LeadsRepository } from './leads.repository.js';
import { LeadsHistoryRepository } from './leadsHistory.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new LeadsRepository();
const historyRepo = new LeadsHistoryRepository();

export const leadsHistoryController = {
  /**
   * GET /api/v1/leads/:id/history
   * Línea de tiempo del lead. Solo lectura: aquí no se escribe nada.
   */
  async history(req, res, next) {
    try {
      // Archivados incluidos: la trazabilidad debe seguir consultable
      const lead = await repo.findByIdIncluyendoArchivado(req.params.id);
      if (!lead) throw new NotFoundError('Lead');

      const { tipo, desde, hasta, limit, cursorFecha, cursorOrden } = req.query;

      const result = await historyRepo.findEvents({
        leadId: lead.id,
        eventType: tipo,
        desde: desde ? desde.toISOString() : undefined,
        hasta: hasta ? hasta.toISOString() : undefined,
        limit: parseInt(limit) || 25,
        cursor: cursorFecha && cursorOrden ? { fecha: cursorFecha.toISOString(), orden: cursorOrden } : null,
      });

      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/leads/:id/summary
   * Indicadores del ciclo de vida para la cabecera del detalle.
   */
  async summary(req, res, next) {
    try {
      // Archivados incluidos: responde también para un lead archivado
      const lead = await repo.findByIdIncluyendoArchivado(req.params.id);
      if (!lead) throw new NotFoundError('Lead');

      const resumen = await historyRepo.findSummary(lead.id);

      res.json({
        success: true,
        data: {
          ...resumen,
          // El lead todavía no tiene historial: se distingue explícitamente de
          // "cero eventos ocurridos" para no presentar datos reconstruidos como auditados.
          tieneHistorial: (resumen?.total_eventos || 0) > 0,
          fechaCreacionOriginal: lead.created_at,
        },
      });
    } catch (err) { next(err); }
  },
};
