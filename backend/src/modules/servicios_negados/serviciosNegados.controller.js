import { serviciosNegadosRepository } from './serviciosNegados.repository.js';
import { AppError } from '../../utils/errors.js';

const CAUSAS_VALIDAS = [
  'Falta de maquina disponible', 'Maquina no disponible', 'Operario no disponible',
  'Falta de tecnicos disponibles', 'Incompatibilidad de horario', 'Precio fuera de presupuesto', 'Otro'
];

export async function listar(req, res, next) {
  try {
    const data = await serviciosNegadosRepository.findAll(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const { fecha_solicitud, empresa_id, empresa_nombre, tipo_equipo, causa, observacion, valor_estimado } = req.body;
    if (!tipo_equipo) throw new AppError('Tipo de equipo es requerido', 400);
    if (!causa) throw new AppError('Causa es requerida', 400);
    if (!CAUSAS_VALIDAS.includes(causa)) throw new AppError('Causa no valida', 400);
    if (causa === 'Otro' && (!observacion || observacion.trim() === '')) {
      throw new AppError('La observacion es obligatoria cuando la causa es Otro', 400);
    }
    if (!empresa_id && (!empresa_nombre || empresa_nombre.trim() === '')) {
      throw new AppError('Debe seleccionar una empresa existente o ingresar el nombre del prospecto', 400);
    }
    const registro = await serviciosNegadosRepository.create({
      fecha_solicitud, empresa_id: empresa_id || null, empresa_nombre: empresa_nombre || '',
      tipo_equipo, causa, observacion, valor_estimado: valor_estimado || 0, registrado_por: req.userId
    });
    res.status(201).json({ success: true, data: registro });
  } catch (err) { next(err); }
}

export async function eliminar(req, res, next) {
  try {
    const deleted = await serviciosNegadosRepository.delete(req.params.id);
    if (!deleted) throw new AppError('Registro no encontrado', 404);
    res.json({ success: true, message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
}

export async function informe(req, res, next) {
  try {
    const data = await serviciosNegadosRepository.getInforme(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export const CAUSAS = CAUSAS_VALIDAS;
