import * as mpService from './mantenimientosProgramados.service.js';

// ─── PLANES ─────────────────────────────────────────────────────

export const getPlanes = async (req, res, next) => {
  try {
    const data = await mpService.getPlanes(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getPlan = async (req, res, next) => {
  try {
    const data = await mpService.getPlanById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const createPlan = async (req, res, next) => {
  try {
    const data = await mpService.createPlan(req.body, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const updatePlan = async (req, res, next) => {
  try {
    const data = await mpService.updatePlan(req.params.id, req.body, req.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const togglePlan = async (req, res, next) => {
  try {
    const data = await mpService.togglePlan(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const deletePlan = async (req, res, next) => {
  try {
    const data = await mpService.deletePlan(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const generarOrden = async (req, res, next) => {
  try {
    const data = await mpService.generarOrdenDesdePlan(req.params.id, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── ÓRDENES ────────────────────────────────────────────────────

export const getOrdenes = async (req, res, next) => {
  try {
    const data = await mpService.getOrdenes(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getOrden = async (req, res, next) => {
  try {
    const data = await mpService.getOrdenById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const createOrden = async (req, res, next) => {
  try {
    const data = await mpService.createOrden(req.body, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const updateOrden = async (req, res, next) => {
  try {
    const data = await mpService.updateOrden(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const cambiarEstado = async (req, res, next) => {
  try {
    const data = await mpService.cambiarEstadoOrden(req.params.id, req.body, req.userId, req.user?.role);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const completarActividad = async (req, res, next) => {
  try {
    const data = await mpService.completarActividad(
      req.params.id, req.params.actId, req.body, req.userId
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const subirEvidencia = async (req, res, next) => {
  try {
    const data = await mpService.subirEvidencia(
      req.params.id, req.file, req.body.descripcion, req.userId
    );
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const eliminarEvidencia = async (req, res, next) => {
  try {
    const data = await mpService.eliminarEvidencia(req.params.id, req.params.evId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getBitacora = async (req, res, next) => {
  try {
    const data = await mpService.getBitacora(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── CALENDARIO E HISTORIAL ─────────────────────────────────────

export const getCalendario = async (req, res, next) => {
  try {
    const data = await mpService.getCalendario(req.query.year, req.query.month);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getHistorialEquipo = async (req, res, next) => {
  try {
    const data = await mpService.getHistorialEquipo(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getHistorialArea = async (req, res, next) => {
  try {
    const data = await mpService.getHistorialArea(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── DASHBOARD ──────────────────────────────────────────────────

export const getKpis = async (req, res, next) => {
  try {
    const data = await mpService.getKpis();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};
