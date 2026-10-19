import { LeadsRepository } from './leads.repository.js';
import { LeadsHistoryRepository } from './leadsHistory.repository.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { notificarAsignacionLead } from '../../services/leadAsignadoNotifier.js';

const repo = new LeadsRepository();
const historyRepo = new LeadsHistoryRepository();

/**
 * Valida que el empleado exista y esté activo antes de persistir una asignación.
 * Lanza los errores que corresponden; nunca devuelve null sin más.
 */
async function assertEmpleadoAsignable(empleadoId) {
  const empleado = await repo.findEmpleadoAsignable(empleadoId);
  if (!empleado) {
    throw new NotFoundError('Empleado asignado');
  }
  if (empleado.status !== 'Activo') {
    throw new ValidationError([
      { field: 'assigned_employee_id', message: `El empleado ${empleado.full_name} está inactivo y no puede recibir asignaciones` },
    ]);
  }
  return empleado;
}

/** Nombre visible del usuario que ejecuta la acción, para el correo y la auditoría. */
function nombreDeUsuario(user) {
  const completo = [user?.nombre, user?.apellido].filter(Boolean).join(' ').trim();
  return completo || user?.email || 'Sistema CRM';
}

export const leadsController = {
  async list(req, res, next) {
    try {
      const { status, assignedTo, source, campaignId, search, limit, cursor, archivados } = req.query;
      const result = await repo.findAll({
        status, assignedTo, source, campaignId, search,
        limit: parseInt(limit) || 50, cursor,
        // `archivados=true` → vista de archivados (solo archivados).
        archivados: archivados === 'true' || archivados === '1',
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  /** Empleados activos para el desplegable "Asignado a". Solo id y nombre. */
  async asignables(req, res, next) {
    try {
      const empleados = await repo.findAsignables(req.query.search);
      res.json({ success: true, data: empleados });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      // Incluye archivados: el lead sigue existiendo con su información íntegra
      const lead = await repo.findByIdIncluyendoArchivado(req.params.id);
      if (!lead) throw new NotFoundError('Lead');
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const data = req.body;

      // El empleado debe existir y estar activo (los inexistentes dan 404, los inactivos 422)
      const empleado = data.assigned_employee_id
        ? await assertEmpleadoAsignable(data.assigned_employee_id)
        : null;

      // El lead y su evento de creación se persisten en LA MISMA transacción:
      // si la auditoría falla, no se crea el lead.
      const { lead, eventoAsignacionId } = await repo.createConHistorial(data, {
        userId: req.userId,
        userName: nombreDeUsuario(req.user),
        empleado: empleado ? { id: empleado.id, nombre: empleado.full_name } : null,
      });

      // El correo se pide DESPUÉS de que el lead quedó confirmado en la base.
      // Si el servicio de correo falla, el lead ya existe y no se revierte nada.
      if (lead.assigned_employee_id && empleado) {
        const resultado = await notificarAsignacionLead({
          lead,
          empleado,
          asignadoPorId: req.userId,
          asignadoPorNombre: nombreDeUsuario(req.user),
          esReasignacion: false,
          empleadoAnteriorId: null,
        });
        await historyRepo.registrarResultadoNotificacion(eventoAsignacionId, resultado);
      }

      res.status(201).json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const actual = await repo.findById(req.params.id);
      if (!actual) throw new NotFoundError('Lead');

      const empleadoNuevo = req.body.assigned_employee_id
        ? await assertEmpleadoAsignable(req.body.assigned_employee_id)
        : null;

      const anterior = actual.assigned_employee_id || null;

      // Modificación + trazabilidad en una sola transacción. Cada campo que cambió
      // genera su evento; si la auditoría falla, se revierte la modificación.
      const resultado = await repo.updateConHistorial(req.params.id, req.body, {
        userId: req.userId,
        userName: nombreDeUsuario(req.user),
        empleado: empleadoNuevo ? { id: empleadoNuevo.id, nombre: empleadoNuevo.full_name } : null,
      });
      if (!resultado) throw new NotFoundError('Lead');

      const { lead, eventoAsignacionId } = resultado;

      // Solo se notifica si el responsable CAMBIÓ de verdad.
      // Cubre: editar sin tocar el responsable (no envía) y repetir la misma
      // petición (el segundo envío ve que ya está asignado y no vuelve a avisar).
      const nuevo = lead.assigned_employee_id || null;

      if (nuevo && nuevo !== anterior) {
        const empleado = empleadoNuevo || await repo.findEmpleadoAsignable(nuevo);
        const envio = await notificarAsignacionLead({
          lead,
          empleado,
          asignadoPorId: req.userId,
          asignadoPorNombre: nombreDeUsuario(req.user),
          esReasignacion: !!anterior,
          empleadoAnteriorId: anterior,
        });
        await historyRepo.registrarResultadoNotificacion(eventoAsignacionId, envio);
      }

      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async convert(req, res, next) {
    try {
      const result = await repo.convertToContact(req.params.id, {
        userId: req.userId,
        userName: nombreDeUsuario(req.user),
      });
      if (!result) throw new NotFoundError('Lead no encontrado o ya convertido');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      // Archivado lógico: no se borra nada, se conserva la trazabilidad
      const result = await repo.delete(req.params.id, {
        userId: req.userId,
        userName: nombreDeUsuario(req.user),
      });
      if (!result) throw new NotFoundError('Lead no encontrado o ya archivado');
      res.json({ success: true, message: 'Lead archivado' });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/v1/leads/:id/restaurar
   *
   * Invierte el archivado. NO pasa por `updateConHistorial`, así que NO se
   * dispara el correo de asignación de la Fase 2: restaurar no cambia el
   * responsable, solo lo devuelve al listado.
   */
  async restore(req, res, next) {
    try {
      const restaurado = await repo.restaurar(req.params.id, {
        userId: req.userId,
        userName: nombreDeUsuario(req.user),
      });
      if (!restaurado) throw new NotFoundError('Lead no encontrado o no está archivado');

      res.json({
        success: true,
        message: 'Lead restaurado. Conserva su estado y su responsable.',
        data: restaurado,
      });
    } catch (err) { next(err); }
  },
};
