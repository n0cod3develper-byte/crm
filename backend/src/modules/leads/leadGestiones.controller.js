import { LeadsRepository } from './leads.repository.js';
import { LeadGestionesRepository } from './leadGestiones.repository.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

const repo = new LeadsRepository();
const gestionesRepo = new LeadGestionesRepository();

/** Nombre visible del usuario que registra la gestión (auditoría). */
function nombreDeUsuario(user) {
  const completo = [user?.nombre, user?.apellido].filter(Boolean).join(' ').trim();
  return completo || user?.email || 'Sistema CRM';
}

/**
 * Resuelve el empleado que realizó la gestión en el BACKEND.
 * El nombre nunca se toma del cliente: se consulta aquí y se guarda el del
 * sistema, igual que en la asignación de la Fase 2.
 */
async function assertEmpleadoActivo(empleadoId) {
  const empleado = await repo.findEmpleadoAsignable(empleadoId);
  if (!empleado) throw new NotFoundError('Empleado asignado a la gestión');
  if (empleado.status !== 'Activo') {
    throw new ValidationError([
      { field: 'employee_id', message: `El empleado ${empleado.full_name} está inactivo y no puede registrar gestiones nuevas` },
    ]);
  }
  return empleado;
}

export const leadGestionesController = {

  /**
   * GET /api/v1/leads/:id/gestiones
   * Listado paginado, más reciente primero. Incluye leads archivados: una
   * gestión ya registrada se conserva y sigue siendo consultable.
   */
  async list(req, res, next) {
    try {
      const lead = await repo.findByIdIncluyendoArchivado(req.params.id);
      if (!lead) throw new NotFoundError('Lead');

      const { tipo, desde, hasta, limit, cursorFecha, cursorId } = req.query;
      const result = await gestionesRepo.findByLead(req.params.id, {
        tipo,
        desde,
        hasta,
        limit: parseInt(limit) || 20,
        cursor: cursorFecha && cursorId ? { fecha: cursorFecha, id: cursorId } : null,
      });

      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/v1/leads/:id/gestiones
   *
   * NO dispara correo de asignación: registrar una gestión no cambia el
   * responsable del lead. El único correo del módulo es el de Fase 2 y vive en
   * el controlador de leads.
   *
   * Un lead ARCHIVADO no recibe gestiones nuevas: está fuera del pipeline
   * comercial. Si hay que anotar algo, primero se restaura. Su historial de
   * gestiones sí sigue siendo consultable (ver `list`).
   */
  async create(req, res, next) {
    try {
      const lead = await repo.findByIdIncluyendoArchivado(req.params.id);
      if (!lead) throw new NotFoundError('Lead');

      if (lead.deleted_at) {
        throw new ValidationError([
          { field: 'id', message: 'Este lead está archivado. Restáuralo antes de registrar una gestión nueva.' },
        ]);
      }

      let empleado = null;
      if (req.body.employee_id) {
        empleado = await assertEmpleadoActivo(req.body.employee_id);
      }

      const gestion = await gestionesRepo.create(req.params.id, {
        ...req.body,
        employee_id: empleado?.id || null,
        employee_name: empleado?.full_name || null,
      }, {
        userId: req.userId,
        userName: nombreDeUsuario(req.user),
      });

      res.status(201).json({
        success: true,
        message: 'Gestión registrada',
        data: gestion,
      });
    } catch (err) { next(err); }
  },
};
