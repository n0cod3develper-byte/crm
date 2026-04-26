import { MantenimientoRepository } from './mantenimiento.repository.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { generateOTPdf } from '../../utils/pdfGenerator.js';

const repo = new MantenimientoRepository();

// ─── Órdenes de Trabajo ────────────────────────────────
export const getAllOTs = async (req, res, next) => {
  try {
    const { empresa_id, equipo_id, estado, tipo_mantenimiento, search, limit, cursor } = req.query;
    const result = await repo.findAllOT({
      empresa_id, equipo_id, estado, tipo_mantenimiento, search,
      limit: parseInt(limit, 10) || 50, cursor
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const getOT = async (req, res, next) => {
  try {
    const ot = await repo.findOTById(req.params.id);
    if (!ot) throw new NotFoundError('Orden de trabajo');
    res.json({ success: true, data: ot });
  } catch (err) { next(err); }
};

export const createOT = async (req, res, next) => {
  try {
    const { empresa_id, equipo_id, tipo_mantenimiento } = req.body;
    if (!empresa_id || !equipo_id || !tipo_mantenimiento) {
      throw new BadRequestError('empresa_id, equipo_id y tipo_mantenimiento son requeridos');
    }
    const result = await repo.createOT(req.body, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const updateOT = async (req, res, next) => {
  try {
    const ot = await repo.findOTById(req.params.id);
    if (!ot) throw new NotFoundError('Orden de trabajo');
    if (ot.estado === 'LIQUIDADA' || ot.estado === 'CERRADA') {
      throw new ForbiddenError('No se puede editar una OT liquidada o cerrada');
    }
    const updated = await repo.updateOT(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

export const deleteOT = async (req, res, next) => {
  try {
    const result = await repo.softDeleteOT(req.params.id);
    if (!result) throw new NotFoundError('Orden de trabajo');
    res.json({ success: true, message: 'OT anulada exitosamente' });
  } catch (err) { next(err); }
};

// ─── Técnicos ──────────────────────────────────────────
export const addTecnico = async (req, res, next) => {
  try {
    const result = await repo.addTecnico(req.params.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const updateTecnico = async (req, res, next) => {
  try {
    const result = await repo.updateTecnico(req.params.id, req.params.tid, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const removeTecnico = async (req, res, next) => {
  try {
    await repo.removeTecnico(req.params.id, req.params.tid);
    res.json({ success: true, message: 'Técnico removido' });
  } catch (err) { next(err); }
};

// ─── Repuestos e insumos ───────────────────────────────
export const addRepuesto = async (req, res, next) => {
  try {
    const result = await repo.addRepuesto(req.params.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const updateRepuesto = async (req, res, next) => {
  try {
    const { cantidad, precio_unitario } = req.body;
    const result = await repo.updateRepuesto(req.params.id, req.params.rid, { cantidad, precio_unitario });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const removeRepuesto = async (req, res, next) => {
  try {
    await repo.removeRepuesto(req.params.id, req.params.rid);
    res.json({ success: true, message: 'Repuesto removido' });
  } catch (err) { next(err); }
};

// ─── Liquidación ───────────────────────────────────────
export const liquidar = async (req, res, next) => {
  try {
    const { notas_liquidacion, impuesto_pct } = req.body;
    const result = await repo.liquidarOT(req.params.id, notas_liquidacion, impuesto_pct, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.codigo === 'OT_FIRMADA_REQUERIDA') {
      return res.status(422).json({
        error: err.message,
        codigo: err.codigo,
        mensaje: err.mensaje,
        ot_consecutivo: err.ot_consecutivo
      });
    }
    if (err.message?.includes('Stock insuficiente') || err.message?.includes('ya está')) {
      return next(new BadRequestError(err.message));
    }
    next(err);
  }
};

// ─── PDF ───────────────────────────────────────────────
export const downloadPDF = async (req, res, next) => {
  try {
    const ot = await repo.findOTById(req.params.id);
    if (!ot) throw new NotFoundError('Orden de trabajo');

    const pdfBuffer = await generateOTPdf(ot);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ot.consecutivo}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

// ─── Inventario search (para el formulario) ────────────
export const searchInventario = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const items = await repo.searchInventario(q);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};
