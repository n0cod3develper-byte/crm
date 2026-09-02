import { CorteContableRepository } from './corteContable.repository.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

const repo = new CorteContableRepository();

export const getAllCortes = async (req, res, next) => {
  try {
    const { estado, limit, cursor } = req.query;
    const result = await repo.findAllCortes({
      estado,
      limit: parseInt(limit, 10) || 50,
      cursor
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const getCorte = async (req, res, next) => {
  try {
    const corte = await repo.getCorteById(req.params.id);
    if (!corte) throw new NotFoundError('Corte contable');
    res.json({ success: true, data: corte });
  } catch (err) { next(err); }
};

export const generarPropuesta = async (req, res, next) => {
  try {
    const { fecha_corte } = req.body;
    if (!fecha_corte) {
      throw new BadRequestError('La fecha de corte es requerida');
    }
    const result = await repo.generarPropuestaCorte(fecha_corte);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const confirmarCorte = async (req, res, next) => {
  try {
    const result = await repo.confirmarCorte(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const cancelarCorte = async (req, res, next) => {
  try {
    const result = await repo.cancelarCorte(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const ejecutarCorte = async (req, res, next) => {
  try {
    const result = await repo.ejecutarCorte(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const cerrarCorte = async (req, res, next) => {
  try {
    const result = await repo.cerrarPeriodo(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const reabrirCorte = async (req, res, next) => {
  try {
    const { justificacion } = req.body;
    const userName = `${req.user.nombre} ${req.user.apellido}`;
    const result = await repo.reabrirPeriodo(req.params.id, req.user.id, userName, justificacion);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getHistorialCadena = async (req, res, next) => {
  try {
    const { cadena_id } = req.params;
    const data = await repo.getHistorialCadena(cadena_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};
