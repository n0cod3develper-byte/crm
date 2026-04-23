import { PMRepository } from './pm.repository.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

const pmRepo = new PMRepository();

// ─── Frecuencias ────────────────────────────────────────────

export const getAllFrecuencias = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const frecuencias = await pmRepo.findAllFrecuencias({ includeInactive });
    res.json({ success: true, data: frecuencias });
  } catch (err) { next(err); }
};

export const getPlantilla = async (req, res, next) => {
  try {
    const plantilla = await pmRepo.getPlantillaCompleta(req.params.id);
    if (!plantilla) throw new NotFoundError('Frecuencia');
    res.json({ success: true, data: plantilla });
  } catch (err) { next(err); }
};

export const createFrecuencia = async (req, res, next) => {
  try {
    const { nombre, horas } = req.body;
    if (!nombre || !horas) throw new BadRequestError('nombre y horas son requeridos');
    const result = await pmRepo.createFrecuencia(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const updateFrecuencia = async (req, res, next) => {
  try {
    const result = await pmRepo.updateFrecuencia(req.params.id, req.body);
    if (!result) throw new NotFoundError('Frecuencia');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Actividades ────────────────────────────────────────────

export const addActividad = async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre) throw new BadRequestError('nombre es requerido');
    const result = await pmRepo.addActividad(req.params.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const updateActividad = async (req, res, next) => {
  try {
    const result = await pmRepo.updateActividad(req.params.id, req.body);
    if (!result) throw new NotFoundError('Actividad');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Insumos de Plantilla ───────────────────────────────────

export const addInsumo = async (req, res, next) => {
  try {
    const { descripcion_display } = req.body;
    if (!descripcion_display) throw new BadRequestError('descripcion_display es requerido');
    const result = await pmRepo.addInsumo(req.params.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const updateInsumo = async (req, res, next) => {
  try {
    const result = await pmRepo.updateInsumo(req.params.id, req.body);
    if (!result) throw new NotFoundError('Insumo');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Actividades de la OT ───────────────────────────────────

export const updateActividadOT = async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!estado) throw new BadRequestError('estado es requerido');
    const valid = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'OMITIDA'];
    if (!valid.includes(estado)) throw new BadRequestError(`Estado inválido. Valores permitidos: ${valid.join(', ')}`);

    const result = await pmRepo.updateActividadOT(req.params.id, req.params.aid, req.body);
    if (!result) throw new NotFoundError('Actividad de OT');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
