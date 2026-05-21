/**
 * turnos.controller.js
 * Endpoints REST del módulo de Control de Turnos.
 */
import * as repo from './turnos.repository.js';
import { calcularExtrasAhora, calcularDesgloseCompleto } from './turnos.service.js';
import { generarFestivosAnio, generarYGuardarFestivos } from '../../services/calendarioService.js';
import { query } from '../../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors.js';

// ─── Helper: obtener empleado_id del usuario autenticado ─────
async function getEmpleadoId(req) {
  const empleadoId = await repo.findEmpleadoIdByUserId(req.user.id);
  return empleadoId || null;
}

// ─── Verificar rol supervisor/admin ──────────────────────────
function assertSupervisorOrAdmin(req) {
  const rol = req.user?.role;
  if (!['admin', 'supervisor_mant'].includes(rol)) {
    throw new ForbiddenError('Solo supervisores y administradores pueden realizar esta acción.');
  }
}

// ══════════════════════════════════════════════════════════════
// TÉCNICO — Vista del propio turno
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/turnos/activo
 * Retorna el turno activo del técnico autenticado para hoy.
 */
export const getTurnoActivo = async (req, res, next) => {
  try {
    const empleadoId = await getEmpleadoId(req);
    if (!empleadoId) {
      return res.status(400).json({ success: false, message: 'El usuario autenticado no tiene un empleado vinculado en el sistema.' });
    }

    const turno      = await repo.findTurnoActivo(empleadoId);

    if (!turno) {
      return res.json({ success: true, turno: null });
    }

    // Calcular extras en tiempo real si el turno está activo
    let extrasAhora = null;
    if (turno.estado === 'ACTIVO' && turno.inicio_turno) {
      extrasAhora = calcularExtrasAhora(turno.inicio_turno, turno.jornada_normal_min || 440);
    }

    res.json({ success: true, turno: { ...turno, extras_tiempo_real: extrasAhora } });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/turnos/servicios/ots-disponibles
 * Lista OTs disponibles.
 */
export const getOTsDisponibles = async (req, res, next) => {
  try {
    const q   = req.query.q || '';
    const ots = await repo.findOTsDisponibles(q);
    res.json({ success: true, data: ots });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/turnos/servicios/iniciar
 * Evento 1: técnico sale de CARGAR hacia una OT.
 * Body: { orden_trabajo_id, salida_cargar, ubicacion_cliente? }
 */
export const iniciarServicio = async (req, res, next) => {
  try {
    const empleadoId = await getEmpleadoId(req);
    if (!empleadoId) {
      return res.status(400).json({ success: false, message: 'El usuario autenticado no tiene un empleado vinculado en el sistema.' });
    }
    const { orden_trabajo_id, salida_cargar, ubicacion_cliente } = req.body;

    if (!salida_cargar) throw new BadRequestError('salida_cargar es requerida.');

    const result = await repo.iniciarServicio(empleadoId, {
      orden_trabajo_id: orden_trabajo_id || null,
      salida_cargar,
      ubicacion_cliente,
      origen_salida_cargar: 'MANUAL',
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.codigo === 'SERVICIOS_INCOMPLETOS') {
      return res.status(409).json({
        success: false,
        error: err.message,
        codigo: err.codigo,
        servicios: err.servicios,
      });
    }
    if (err.codigo === 'TURNO_CERRADO') {
      return res.status(409).json({
        success: false,
        error: err.message,
        codigo: err.codigo,
        turnoId: err.turnoId,
      });
    }
    next(err);
  }
};

/**
 * PATCH /api/v1/turnos/servicios/:id/inicio-servicio
 * Evento 2: técnico llega donde el cliente.
 * Body: { inicio_servicio: ISO8601 }
 */
export const registrarInicioServicio = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inicio_servicio } = req.body;
    if (!inicio_servicio) throw new BadRequestError('inicio_servicio es requerida.');

    const servicio = await repo.registrarInicioServicio(id, { inicio_servicio });
    res.json({ success: true, data: servicio });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/turnos/servicios/:id/fin-servicio
 * Evento 3: técnico termina el trabajo.
 * Body: { fin_servicio: ISO8601, notas_tecnico?: string }
 */
export const registrarFinServicio = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fin_servicio, notas_tecnico } = req.body;
    if (!fin_servicio) throw new BadRequestError('fin_servicio es requerida.');

    const servicio = await repo.registrarFinServicio(id, { fin_servicio, notas_tecnico });
    res.json({ success: true, data: servicio });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/turnos/servicios/:id/ingreso-cargar
 * Evento 4: técnico regresa a CARGAR.
 * Body: { ingreso_cargar: ISO8601 }
 */
export const registrarIngresoCargar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ingreso_cargar } = req.body;
    if (!ingreso_cargar) throw new BadRequestError('ingreso_cargar es requerida.');

    const servicio = await repo.registrarIngresoCargar(id, { ingreso_cargar });
    res.json({ success: true, data: servicio });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/turnos/:id/cerrar
 * Evento 5: fin de turno del día.
 * Body: { fin_turno: ISO8601, forzar?: boolean }
 */
export const cerrarTurno = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fin_turno, forzar } = req.body;
    if (!fin_turno) throw new BadRequestError('fin_turno es requerida.');

    const result = await repo.cerrarTurno(id, {
      fin_turno,
      forzar: forzar === true,
      userId: req.user.id,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.codigo === 'SERVICIOS_INCOMPLETOS') {
      return res.status(409).json({
        success: false,
        error: err.message,
        codigo: err.codigo,
        servicios: err.servicios,
        mensaje: 'Confirma el cierre enviando forzar: true para cerrar de todas formas.',
      });
    }
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════
// SUPERVISOR — Monitoreo y aprobaciones
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/turnos
 * Lista turnos con filtros. Solo Supervisor y Admin.
 * Query: ?fecha=YYYY-MM-DD &empleado_id=uuid &estado=ACTIVO|CERRADO
 */
export const listarTurnos = async (req, res, next) => {
  try {
    assertSupervisorOrAdmin(req);
    const { fecha, fecha_desde, fecha_hasta, empleado_id, estado, limit } = req.query;
    const turnos = await repo.findTurnos({
      fecha,
      fecha_desde,
      fecha_hasta,
      empleado_id,
      estado,
      limit: parseInt(limit, 10) || 50,
    });
    res.json({ success: true, data: turnos });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/turnos/resumen-semana
 * Resumen de horas extras por técnico en la semana actual.
 */
export const resumenSemana = async (req, res, next) => {
  try {
    assertSupervisorOrAdmin(req);
    const semana = req.query.semana || null;
    const data   = await repo.resumenSemana(semana);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/turnos/:id/aprobar-extras
 * Supervisor aprueba las horas extras del turno.
 * Body: { aprobado: true, observaciones?: string }
 */
export const aprobarExtras = async (req, res, next) => {
  try {
    assertSupervisorOrAdmin(req);
    const { id } = req.params;
    const { aprobado, observaciones } = req.body;

    if (!aprobado) throw new BadRequestError('Debes confirmar la aprobación (aprobado: true).');

    const turno = await repo.aprobarExtras(id, {
      aprobado,
      observaciones,
      userId: req.user.id,
    });
    if (!turno) throw new NotFoundError('Turno');
    res.json({ success: true, data: turno });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// FESTIVOS Y DESGLOSE DE RECARGOS
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/turnos/festivos/:anio
 * Lista los festivos de un año. Si no existen en BD, los genera.
 */
export const listarFestivos = async (req, res, next) => {
  try {
    const { anio } = req.params;
    const anioNum = parseInt(anio, 10);
    if (isNaN(anioNum) || anioNum < 2020 || anioNum > 2100) {
      throw new BadRequestError('Año inválido. Debe ser entre 2020 y 2100.');
    }

    const existentes = await query(
      'SELECT COUNT(*) AS cnt FROM festivos_colombia WHERE anio = $1',
      [anioNum]
    );

    if (parseInt(existentes.rows[0].cnt, 10) === 0) {
      await generarYGuardarFestivos(anioNum);
    }

    const festivos = await query(
      'SELECT * FROM festivos_colombia WHERE anio = $1 AND activo = TRUE ORDER BY fecha',
      [anioNum]
    );

    res.json({ success: true, data: festivos.rows });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/admin/festivos
 * Agregar un festivo personalizado (admin only).
 * Body: { fecha: 'YYYY-MM-DD', nombre: string, tipo?: 'PERSONALIZADO' }
 */
export const crearFestivo = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Solo administradores pueden crear festivos.');
    }
    const { fecha, nombre, tipo = 'PERSONALIZADO' } = req.body;
    if (!fecha || !nombre) throw new BadRequestError('fecha y nombre son requeridos.');

    const anio = new Date(fecha).getFullYear();
    const result = await query(
      `INSERT INTO festivos_colombia (fecha, nombre, tipo, anio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fecha) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo
       RETURNING *`,
      [fecha, nombre, tipo, anio]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/admin/festivos/:id
 * Eliminar un festivo personalizado (admin only).
 */
export const eliminarFestivo = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Solo administradores pueden eliminar festivos.');
    }
    const { id } = req.params;

    const existing = await query('SELECT tipo FROM festivos_colombia WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Festivo');
    if (existing.rows[0].tipo !== 'PERSONALIZADO') {
      throw new BadRequestError('No se pueden eliminar festivos legales (fecha fija, Ley Emiliani o religiosos).');
    }

    await query('DELETE FROM festivos_colombia WHERE id = $1', [id]);
    res.json({ success: true, message: 'Festivo eliminado.' });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/turnos/:id/reabrir
 * Reabre un turno cerrado para que el técnico pueda continuar.
 */
export const reabrirTurno = async (req, res, next) => {
  try {
    const empleadoId = await getEmpleadoId(req);
    const { id } = req.params;

    const turno = await repo.reabrirTurno(id, empleadoId);
    res.json({ success: true, data: turno });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/turnos/:id/desglose-recargos
 * Retorna el desglose completo de recargos de un turno.
 */
export const getDesgloseRecargos = async (req, res, next) => {
  try {
    const { id } = req.params;

    const turnoRes = await query(
      `SELECT * FROM turnos_tecnicos WHERE id = $1`,
      [id]
    );
    if (!turnoRes.rows[0]) throw new NotFoundError('Turno');
    const turno = turnoRes.rows[0];

    const detalleRes = await query(
      `SELECT * FROM turno_minutos_detalle WHERE turno_id = $1 ORDER BY hora_inicio`,
      [id]
    );

    let desglose = null;
    if (detalleRes.rows.length === 0 && turno.inicio_turno && turno.fin_turno) {
      const calc = await calcularDesgloseCompleto({
        inicio_turno: turno.inicio_turno,
        fin_turno: turno.fin_turno,
        fecha_turno: turno.fecha_turno,
      });
      if (calc.completo) {
        desglose = {
          min_ord_diurnos: calc.min_ord_diurnos,
          min_ord_nocturnos: calc.min_ord_nocturnos,
          min_extra_diurnos: calc.min_extra_diurnos,
          min_extra_nocturnos: calc.min_extra_nocturnos,
          min_dom_fest_ord: calc.min_dom_fest_ord,
          min_dom_fest_extra_d: calc.min_dom_fest_extra_d,
          min_dom_fest_extra_n: calc.min_dom_fest_extra_n,
          bloques: calc.desgloseBloques,
          es_domingo: calc.esDomingo,
          es_festivo: calc.esFestivo,
          nombre_festivo: calc.nombreFestivo,
        };
      }
    }

    const r = (m) => m != null ? Math.round((m / 60) * 100) / 100 : 0;

    res.json({
      success: true,
      data: {
        turno_id: turno.id,
        fecha_turno: turno.fecha_turno,
        es_domingo: turno.es_domingo || desglose?.es_domingo || false,
        es_festivo: turno.es_festivo || desglose?.es_festivo || false,
        nombre_festivo: turno.nombre_festivo || desglose?.nombre_festivo || null,
        jornada_normal_min: turno.jornada_normal_min,
        total_minutos: turno.tiempo_total_min,
        desglose: {
          ord_diurnos:      { minutos: turno.min_ord_diurnos     || desglose?.min_ord_diurnos     || 0, horas: r(turno.min_ord_diurnos     || desglose?.min_ord_diurnos    ), recargo_pct: 0   },
          ord_nocturnos:    { minutos: turno.min_ord_nocturnos   || desglose?.min_ord_nocturnos   || 0, horas: r(turno.min_ord_nocturnos   || desglose?.min_ord_nocturnos  ), recargo_pct: 35  },
          extra_diurnos:    { minutos: turno.min_extra_diurnos   || desglose?.min_extra_diurnos   || 0, horas: r(turno.min_extra_diurnos   || desglose?.min_extra_diurnos  ), recargo_pct: 25  },
          extra_nocturnos:  { minutos: turno.min_extra_nocturnos || desglose?.min_extra_nocturnos || 0, horas: r(turno.min_extra_nocturnos || desglose?.min_extra_nocturnos), recargo_pct: 75  },
          dom_fest_ord:     { minutos: turno.min_dom_fest_ord    || desglose?.min_dom_fest_ord    || 0, horas: r(turno.min_dom_fest_ord    || desglose?.min_dom_fest_ord   ), recargo_pct: 75  },
          dom_fest_extra_d: { minutos: turno.min_dom_fest_extra_d || desglose?.min_dom_fest_extra_d || 0, horas: r(turno.min_dom_fest_extra_d || desglose?.min_dom_fest_extra_d), recargo_pct: 100 },
          dom_fest_extra_n: { minutos: turno.min_dom_fest_extra_n || desglose?.min_dom_fest_extra_n || 0, horas: r(turno.min_dom_fest_extra_n || desglose?.min_dom_fest_extra_n), recargo_pct: 150 },
        },
        bloques_auditoria: detalleRes.rows.length > 0 ? detalleRes.rows : (desglose?.bloques || []),
        alerta_limite_legal: turno.alerta_limite_legal || false,
      },
    });
  } catch (err) { next(err); }
};
