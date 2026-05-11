import { ServiciosRepository } from './servicios.repository.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors.js';
import { generateRemisionPdf } from '../../utils/remisionPdfGenerator.js';

const repo = new ServiciosRepository();

export const serviciosController = {
  async list(req, res, next) {
    try {
      const { company_id, equipo_id, estado, fecha_desde, fecha_hasta, search, limit, cursor } = req.query;
      const result = await repo.findAll({ company_id, equipo_id, estado, fecha_desde, fecha_hasta, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) throw new NotFoundError('Remisión');
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { fecha_servicio, company_id, catalogo_servicio_id, equipo_id } = req.body;
      if (!fecha_servicio || !company_id || !catalogo_servicio_id || !equipo_id) {
        throw new BadRequestError('fecha_servicio, company_id, catalogo_servicio_id y equipo_id son requeridos');
      }
      const item = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) throw new NotFoundError('Remisión');

      // Campos que el modal de liquidación puede actualizar incluso en estado LIQUIDADA
      const liquidacionFields = new Set([
        'hora_salida_cargar', 'hora_llegada_cargar',
        'segundo_hora_salida_cargar', 'segundo_hora_llegada_cargar',
        'cantidad_horas', 'total_bruto', 'iva_valor', 'total_neto', 'estado'
      ]);
      const incomingKeys = Object.keys(req.body);
      const isLiquidacionPatch = incomingKeys.length > 0 && incomingKeys.every(k => liquidacionFields.has(k));

      // Bloquear edición completa de remisiones ANULADAS o LIQUIDADAS
      // (solo se permite el patch parcial de la liquidación)
      if (item.estado === 'ANULADO') {
        throw new ForbiddenError('No se puede editar una remisión ANULADA');
      }
      if (item.estado === 'LIQUIDADA' && !isLiquidacionPatch) {
        throw new ForbiddenError('No se puede editar una remisión LIQUIDADA. Solo se permiten actualizaciones de liquidación.');
      }

      const updated = await repo.update(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.softDelete(req.params.id);
      if (!result) throw new NotFoundError('Remisión');
      res.json({ success: true, message: 'Remisión anulada correctamente' });
    } catch (err) { next(err); }
  },

  async getOperariosDisponibles(req, res, next) {
    try {
      const data = await repo.findOperariosDisponibles();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getLastFormaPago(req, res, next) {
    try {
      const formaPago = await repo.findLastFormaPago(req.params.company_id);
      res.json({ success: true, data: formaPago });
    } catch (err) { next(err); }
  },

  async addOperario(req, res, next) {
    try {
      const { empleado_id } = req.body;
      if (!empleado_id) throw new BadRequestError('empleado_id es requerido');
      const result = await repo.addOperario(req.params.id, empleado_id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async removeOperario(req, res, next) {
    try {
      await repo.removeOperario(req.params.id, req.params.oid);
      res.json({ success: true, message: 'Operario removido' });
    } catch (err) { next(err); }
  },

  async downloadPDF(req, res, next) {
    try {
      const remision = await repo.findById(req.params.id);
      if (!remision) throw new NotFoundError('Remisión');
      
      const horasLaborales = await repo.findHorasLaborales(req.params.id) || [];
      const pdfBuffer = await generateRemisionPdf(remision, horasLaborales);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Remision-${remision.numero_remision}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
    } catch (err) { next(err); }
  },

  // ─── Liquidación de Horas Laborales ────────────────────────────

  async getHorasLaborales(req, res, next) {
    try {
      const data = await repo.findHorasLaborales(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async upsertHorasLaborales(req, res, next) {
    try {
      const { empleado_id, fecha_trabajo, hora_entrada, hora_salida } = req.body;
      if (!empleado_id || !fecha_trabajo || !hora_entrada || !hora_salida) {
        throw new BadRequestError('empleado_id, fecha_trabajo, hora_entrada y hora_salida son requeridos');
      }
      const result = await repo.upsertHorasLaborales(req.params.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async deleteHorasLaborales(req, res, next) {
    try {
      await repo.deleteHorasLaborales(req.params.id, req.params.hid);
      res.json({ success: true, message: 'Liquidación eliminada' });
    } catch (err) { next(err); }
  },
};

