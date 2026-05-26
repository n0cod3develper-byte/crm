/**
 * turnos.repository.js
 * Todas las operaciones de base de datos del módulo de Control de Turnos.
 */
import { query, withTransaction } from '../../config/database.js';
import { calcularTiemposTurno, calcularDesgloseCompleto, calcularTiemposServicio } from './turnos.service.js';

// ──────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ──────────────────────────────────────────────────────────────

/** Convierte un Timestamp a fecha ISO (YYYY-MM-DD) */
const toDate = (ts) => (ts ? new Date(ts).toISOString().split('T')[0] : null);

/** Convierte un Timestamp a hora HH:MM:SS */
const toTime = (ts) => (ts ? new Date(ts).toTimeString().substring(0, 8) : null);

/** Obtiene la configuración activa de turnos */
async function getConfig(client = null) {
  const fn = client ? (s, p) => client.query(s, p) : query;
  const res = await fn(
    `SELECT jornada_normal_min, hora_inicio_diurno, hora_fin_diurno,
            limite_extras_diarias_min, limite_extras_semanales_min,
            cerrar_turno_automatico, hora_cierre_automatico
     FROM configuracion_turnos WHERE activo = TRUE LIMIT 1`,
    []
  );
  return res.rows[0] || { jornada_normal_min: 440, limite_extras_diarias_min: 120 };
}

/** Busca el employee_id del usuario autenticado */
export async function findEmpleadoIdByUserId(userId) {
  const res = await query(
    `SELECT id FROM employees WHERE user_id = $1 AND status = 'Activo' LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.id || null;
}

// ──────────────────────────────────────────────────────────────
// TURNO DEL DÍA
// ──────────────────────────────────────────────────────────────

/**
 * Retorna el turno activo del técnico para hoy, con todos sus servicios y la OT.
 */
export async function findTurnoActivo(empleadoId) {
  const hoy = new Date().toISOString().split('T')[0];

  const turnoRes = await query(
    `SELECT * FROM turnos_tecnicos
     WHERE empleado_id = $1 AND fecha_turno = $2 AND estado = 'ACTIVO'`,
    [empleadoId, hoy]
  );

  if (!turnoRes.rows[0]) return null;
  const turno = turnoRes.rows[0];

  // Cargar servicios con info de OT
  const serviciosRes = await query(
    `SELECT ts.*,
            ot.consecutivo    AS ot_consecutivo,
            ot.estado         AS ot_estado,
            ot.detalle_servicio AS ot_detalle,
            c.name            AS empresa,
            e.marca || ' ' || e.modelo AS equipo
     FROM turno_servicios ts
     LEFT JOIN ordenes_trabajo ot ON ot.id = ts.orden_trabajo_id
     LEFT JOIN companies c  ON c.id = ot.empresa_id
     LEFT JOIN equipos e    ON e.id = ot.equipo_id
     WHERE ts.turno_id = $1
     ORDER BY ts.numero_servicio_dia ASC`,
    [turno.id]
  );
  turno.servicios = serviciosRes.rows;
  return turno;
}

/**
 * Crea el turno del día si no existe, o lo retorna si ya existe.
 * Llamado dentro de una transacción al registrar el primer servicio.
 */
async function findOrCreateTurno(client, empleadoId, fechaTurno) {
  // Intentar obtener turno existente (ACTIVO o CERRADO)
  const existing = await client.query(
    `SELECT * FROM turnos_tecnicos WHERE empleado_id = $1 AND fecha_turno = $2`,
    [empleadoId, fechaTurno]
  );
  if (existing.rows[0]) return existing.rows[0];

  const res = await client.query(
    `INSERT INTO turnos_tecnicos (empleado_id, fecha_turno, estado)
     VALUES ($1, $2, 'ACTIVO') RETURNING *`,
    [empleadoId, fechaTurno]
  );
  return res.rows[0];
}

// ──────────────────────────────────────────────────────────────
// EVENTO 1: Salida de CARGAR (iniciar servicio)
// ──────────────────────────────────────────────────────────────

/**
 * Registra la salida del técnico hacia una OT.
 * Crea o recupera el turno del día. Es la transacción más compleja.
 */
export async function iniciarServicio(empleadoId, data) {
  const {
    orden_trabajo_id,
    salida_cargar,
    ubicacion_cliente,
    origen_salida_cargar = 'MANUAL',
  } = data;

  return await withTransaction(async (client) => {
    const fechaTurno = new Date(salida_cargar).toISOString().split('T')[0];

    // 1. Obtener o crear turno del día
    const turno = await findOrCreateTurno(client, empleadoId, fechaTurno);

    if (turno.estado === 'CERRADO' || turno.estado === 'CERRADO_AUTO') {
      throw Object.assign(
        new Error('El turno del día ya está cerrado. No se puede iniciar un nuevo servicio.'),
        { codigo: 'TURNO_CERRADO', turnoId: turno.id }
      );
    }

    // 2. Verificar que no hay otro servicio en curso
    const enCurso = await client.query(
      `SELECT id FROM turno_servicios
       WHERE turno_id = $1 AND estado_servicio != 'COMPLETADO'`,
      [turno.id]
    );
    if (enCurso.rows.length > 0) {
      throw new Error('Ya tienes un servicio en curso. Complétalo antes de iniciar uno nuevo.');
    }

    // 3. Verificar OT si se proporcionó
    if (orden_trabajo_id) {
      const otRes = await client.query(
        `SELECT estado FROM ordenes_trabajo WHERE id = $1 AND deleted_at IS NULL`,
        [orden_trabajo_id]
      );
      if (!otRes.rows[0]) throw new Error('Orden de trabajo no encontrada.');
      const otEstado = otRes.rows[0].estado;
      if (!['ABIERTA', 'EN_PROCESO'].includes(otEstado)) {
        throw new Error(`La OT está en estado ${otEstado} y no puede recibir servicios.`);
      }
    }

    // 4. Determinar el número de servicio en el turno
    const cntRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM turno_servicios WHERE turno_id = $1`,
      [turno.id]
    );
    const numeroServicioDia = parseInt(cntRes.rows[0].cnt) + 1;

    // 5. Crear el servicio
    const servicioRes = await client.query(
      `INSERT INTO turno_servicios (
          turno_id, empleado_id, orden_trabajo_id,
          numero_servicio_dia, estado_servicio,
          salida_cargar, origen_salida_cargar, ubicacion_cliente
        ) VALUES ($1,$2,$3,$4,'EN_DESPLAZAMIENTO',$5,$6,$7)
        RETURNING *`,
      [
        turno.id, empleadoId, orden_trabajo_id || null,
        numeroServicioDia,
        new Date(salida_cargar),
        origen_salida_cargar,
        ubicacion_cliente || null,
      ]
    );
    const servicio = servicioRes.rows[0];

    // 6. Si es el primer servicio del día: registrar inicio_turno
    if (numeroServicioDia === 1) {
      await client.query(
        `UPDATE turnos_tecnicos
         SET inicio_turno = $1, origen_inicio = $2, updated_at = NOW()
         WHERE id = $3`,
        [new Date(salida_cargar), origen_salida_cargar, turno.id]
      );
      turno.inicio_turno = new Date(salida_cargar);
    }

    // 7. Sincronizar con ot_tecnicos (Evento 1)
    if (orden_trabajo_id) {
      await sincronizarConOT(client, { ...servicio, orden_trabajo_id });

      // Cambiar OT a EN_PROCESO si estaba ABIERTA
      await client.query(
        `UPDATE ordenes_trabajo SET estado = 'EN_PROCESO', updated_at = NOW()
         WHERE id = $1 AND estado = 'ABIERTA'`,
        [orden_trabajo_id]
      );
    }

    return { turno, servicio };
  });
}

// ──────────────────────────────────────────────────────────────
// EVENTO 2: Inicio del servicio (llega donde el cliente)
// ──────────────────────────────────────────────────────────────

export async function registrarInicioServicio(servicioId, data) {
  const { inicio_servicio, origen = 'MANUAL' } = data;

  const servicioRes = await query(
    `SELECT * FROM turno_servicios WHERE id = $1`,
    [servicioId]
  );
  if (!servicioRes.rows[0]) throw new Error('Servicio no encontrado.');
  const servicio = servicioRes.rows[0];

  if (servicio.estado_servicio !== 'EN_DESPLAZAMIENTO') {
    throw new Error(`Estado del servicio es ${servicio.estado_servicio}. Se esperaba EN_DESPLAZAMIENTO.`);
  }
  if (new Date(inicio_servicio) < new Date(servicio.salida_cargar)) {
    throw new Error('La hora de inicio de servicio debe ser posterior o igual a la hora de salida de CARGAR.');
  }

  const tiempos = calcularTiemposServicio({ ...servicio, inicio_servicio });

  const res = await query(
    `UPDATE turno_servicios SET
       inicio_servicio = $1,
       origen_inicio_servicio = $2,
       tiempo_desplazamiento_ida_min = $3,
       estado_servicio = 'EN_SERVICIO',
       updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [
      new Date(inicio_servicio),
      origen,
      tiempos.tiempoDesplazamientoIdaMin,
      servicioId,
    ]
  );
  return res.rows[0];
}

// ──────────────────────────────────────────────────────────────
// EVENTO 3: Fin del servicio (termina el trabajo)
// ──────────────────────────────────────────────────────────────

export async function registrarFinServicio(servicioId, data) {
  const { fin_servicio, notas_tecnico, origen = 'MANUAL' } = data;

  const servicioRes = await query(
    `SELECT * FROM turno_servicios WHERE id = $1`,
    [servicioId]
  );
  if (!servicioRes.rows[0]) throw new Error('Servicio no encontrado.');
  const servicio = servicioRes.rows[0];

  if (servicio.estado_servicio !== 'EN_SERVICIO') {
    throw new Error(`Estado del servicio es ${servicio.estado_servicio}. Se esperaba EN_SERVICIO.`);
  }
  if (new Date(fin_servicio) < new Date(servicio.inicio_servicio)) {
    throw new Error('La hora de fin de servicio debe ser posterior o igual al inicio del servicio.');
  }

  const tiempos = calcularTiemposServicio({ ...servicio, fin_servicio });

  const res = await query(
    `UPDATE turno_servicios SET
       fin_servicio = $1,
       origen_fin_servicio = $2,
       tiempo_servicio_efectivo_min = $3,
       notas_tecnico = $4,
       estado_servicio = 'REGRESANDO',
       updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [
      new Date(fin_servicio),
      origen,
      tiempos.tiempoServicioEfectivoMin,
      notas_tecnico || null,
      servicioId,
    ]
  );
  return res.rows[0];
}

// ──────────────────────────────────────────────────────────────
// EVENTO 4: Ingreso a CARGAR (regresa de la OT)
// ──────────────────────────────────────────────────────────────

export async function registrarIngresoCargar(servicioId, data) {
  const { ingreso_cargar, origen = 'MANUAL' } = data;

  return await withTransaction(async (client) => {
    const servicioRes = await client.query(
      `SELECT * FROM turno_servicios WHERE id = $1 FOR UPDATE`,
      [servicioId]
    );
    if (!servicioRes.rows[0]) throw new Error('Servicio no encontrado.');
    const servicio = servicioRes.rows[0];

    if (servicio.estado_servicio !== 'REGRESANDO') {
      throw new Error(`Estado del servicio es ${servicio.estado_servicio}. Se esperaba REGRESANDO.`);
    }

    // Validar orden temporal: ingreso > fin_servicio
    const refTime = servicio.fin_servicio || servicio.inicio_servicio || servicio.salida_cargar;
    if (refTime && new Date(ingreso_cargar) < new Date(refTime)) {
      throw new Error('La hora de ingreso a CARGAR debe ser posterior o igual al fin del servicio.');
    }

    // Calcular todos los tiempos del servicio
    const tiempos = calcularTiemposServicio({
      ...servicio,
      ingreso_cargar,
    });

    // Actualizar turno_servicio
    const updatedServicio = (await client.query(
      `UPDATE turno_servicios SET
         ingreso_cargar = $1,
         origen_ingreso_cargar = $2,
         tiempo_desplazamiento_vuelta_min = $3,
         tiempo_total_servicio_min = $4,
         estado_servicio = 'COMPLETADO',
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        new Date(ingreso_cargar),
        origen,
        tiempos.tiempoDesplazamientoVueltaMin,
        tiempos.tiempoTotalServicioMin,
        servicioId,
      ]
    )).rows[0];

    // Sincronizar con ot_tecnicos (Evento 4 + tiempos)
    if (servicio.orden_trabajo_id) {
      await sincronizarConOT(client, updatedServicio);
    }

    // Actualizar tiempo transcurrido en el turno (parcial, sin cerrar)
    const turnoRes = await client.query(
      `SELECT * FROM turnos_tecnicos WHERE id = $1`,
      [servicio.turno_id]
    );
    const turno = turnoRes.rows[0];

    // Calcular extras acumuladas hasta el ingreso actual (aproximación)
    if (turno?.inicio_turno) {
      const config = await getConfig(client);
      const tempTurno = { inicio_turno: turno.inicio_turno, fin_turno: new Date(ingreso_cargar) };
      const calc = calcularTiemposTurno(tempTurno, config);
      if (calc.completo) {
        await client.query(
          `UPDATE turnos_tecnicos SET
             tiempo_total_min = $1,
             minutos_extras = $2,
             horas_extras = $3,
             alerta_limite_legal = $4,
             updated_at = NOW()
           WHERE id = $5`,
          [
            calc.tiempoTotalMin,
            calc.minutosExtras,
            calc.horasExtras,
            calc.alertaLimiteLegal,
            turno.id,
          ]
        );
      }
    }

    return updatedServicio;
  });
}

// ──────────────────────────────────────────────────────────────
// EVENTO 5: Cerrar turno
// ──────────────────────────────────────────────────────────────

export async function cerrarTurno(turnoId, data) {
  const { fin_turno, forzar = false, userId } = data;

  return await withTransaction(async (client) => {
    // Bloquear el turno
    const turnoRes = await client.query(
      `SELECT * FROM turnos_tecnicos WHERE id = $1 AND estado = 'ACTIVO' FOR UPDATE`,
      [turnoId]
    );
    if (!turnoRes.rows[0]) throw new Error('Turno no encontrado o ya cerrado.');
    const turno = turnoRes.rows[0];

    // Verificar servicios incompletos
    const incompletosRes = await client.query(
      `SELECT id, numero_servicio_dia FROM turno_servicios
       WHERE turno_id = $1 AND estado_servicio != 'COMPLETADO'`,
      [turnoId]
    );
    if (incompletosRes.rows.length > 0 && !forzar) {
      throw Object.assign(
        new Error('Hay servicios sin completar.'),
        { codigo: 'SERVICIOS_INCOMPLETOS', servicios: incompletosRes.rows }
      );
    }

    // Validar que fin_turno >= inicio_turno
    if (turno.inicio_turno && new Date(fin_turno) < new Date(turno.inicio_turno)) {
      throw new Error('La hora de fin de turno debe ser posterior o igual al inicio.');
    }

    // Calcular tiempos con desglose CST completo
    const config = await getConfig(client);
    const calc   = await calcularDesgloseCompleto(
      { inicio_turno: turno.inicio_turno, fin_turno, fecha_turno: turno.fecha_turno },
      config
    );

    if (!calc.completo) {
      throw new Error('No se pudieron calcular los tiempos del turno.');
    }

    // Guardar desglose minuto a minuto en turno_minutos_detalle
    if (calc.desgloseBloques?.length > 0) {
      for (const bloque of calc.desgloseBloques) {
        await client.query(
          `INSERT INTO turno_minutos_detalle
             (turno_id, recargo_codigo, hora_inicio, hora_fin, minutos,
              es_extra, es_dominical_festivo, porcentaje_recargo, total_pct)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            turnoId,
            bloque.recargo_codigo,
            bloque.inicio,
            bloque.fin,
            bloque.minutos,
            bloque.es_extra,
            bloque.es_dominical_festivo,
            bloque.porcentaje_recargo,
            bloque.total_pct,
          ]
        );
      }
    }

    // Actualizar turno con todos los campos incluyendo desglose CST
    const updatedTurnoRes = await client.query(
      `UPDATE turnos_tecnicos SET
         fin_turno               = $1,
         estado                  = 'CERRADO',
         origen_fin              = $2,
         tiempo_total_min        = $3,
         jornada_normal_min      = $4,
         minutos_extras          = $5,
         horas_extras            = $6,
         horas_extras_diurnas    = $7,
         horas_extras_nocturnas  = $8,
         alerta_limite_legal     = $9,
         min_ord_diurnos         = $10,
         min_ord_nocturnos       = $11,
         min_extra_diurnos       = $12,
         min_extra_nocturnos     = $13,
         min_dom_fest_ord        = $14,
         min_dom_fest_extra_d    = $15,
         min_dom_fest_extra_n    = $16,
         es_domingo              = $17,
         es_festivo              = $18,
         nombre_festivo          = $19,
         updated_at              = NOW()
       WHERE id = $20 RETURNING *`,
      [
        new Date(fin_turno),
        'MANUAL',
        calc.tiempoTotalMin,
        calc.jornadaNormalMin,
        calc.minutosExtras,
        calc.horasExtras,
        calc.horasExtrasDiurnas,
        calc.horasExtrasNocturnas,
        calc.alertaLimiteLegal,
        calc.min_ord_diurnos      || 0,
        calc.min_ord_nocturnos    || 0,
        calc.min_extra_diurnos    || 0,
        calc.min_extra_nocturnos  || 0,
        calc.min_dom_fest_ord     || 0,
        calc.min_dom_fest_extra_d || 0,
        calc.min_dom_fest_extra_n || 0,
        calc.esDomingo            || false,
        calc.esFestivo            || false,
        calc.nombreFestivo        || null,
        turnoId,
      ]
    );

    return { turno: updatedTurnoRes.rows[0], calculo: calc };
  });
}

// ──────────────────────────────────────────────────────────────
// SINCRONIZACIÓN CON ot_tecnicos
// ──────────────────────────────────────────────────────────────

/**
 * Sincroniza los datos del turno_servicio con la tabla ot_tecnicos.
 * Siempre se llama dentro de una transacción.
 * @param {Object} client - Cliente de transacción pg
 * @param {Object} servicio - turno_servicio completo
 */
async function sincronizarConOT(client, servicio) {
  if (!servicio.orden_trabajo_id) return;

  // Verificar si el técnico ya está en la OT
  const otTecnicoRes = await client.query(
    `SELECT id, tarifa_hora FROM ot_tecnicos
     WHERE orden_trabajo_id = $1 AND empleado_id = $2`,
    [servicio.orden_trabajo_id, servicio.empleado_id]
  );

  if (otTecnicoRes.rows.length === 0) {
    // Auto-asignar el técnico a la OT
    await client.query(
      `INSERT INTO ot_tecnicos (
          orden_trabajo_id, empleado_id,
          fecha_salida, hora_salida,
          turno_servicio_id, origen_registro, tarifa_hora
        ) VALUES ($1,$2,$3,$4,$5,'TURNO',
          COALESCE((SELECT hourly_rate FROM employees WHERE id = $2), 0)
        )`,
      [
        servicio.orden_trabajo_id,
        servicio.empleado_id,
        toDate(servicio.salida_cargar),
        toTime(servicio.salida_cargar),
        servicio.id,
      ]
    );
  } else {
    // Actualizar registro existente
    const otTecnicoId  = otTecnicoRes.rows[0].id;
    const tarifaHora   = otTecnicoRes.rows[0].tarifa_hora || 0;

    // Calcular mano de obra si hay tiempos completos
    let totalManoObra = null;
    if (servicio.tiempo_total_servicio_min != null && tarifaHora > 0) {
      totalManoObra = Math.round((servicio.tiempo_total_servicio_min / 60) * tarifaHora * 100) / 100;
    }

    await client.query(
      `UPDATE ot_tecnicos SET
         fecha_salida       = COALESCE($1, fecha_salida),
         hora_salida        = COALESCE($2, hora_salida),
         fecha_regreso      = COALESCE($3, fecha_regreso),
         hora_regreso       = COALESCE($4, hora_regreso),
         tiempo_total_min   = COALESCE($5, tiempo_total_min),
         total_mano_obra    = COALESCE($6, total_mano_obra),
         turno_servicio_id  = $7,
         origen_registro    = 'TURNO'
       WHERE id = $8`,
      [
        toDate(servicio.salida_cargar),
        toTime(servicio.salida_cargar),
        toDate(servicio.ingreso_cargar),
        toTime(servicio.ingreso_cargar),
        servicio.tiempo_total_servicio_min,
        totalManoObra,
        servicio.id,
        otTecnicoId,
      ]
    );
  }
}

// ──────────────────────────────────────────────────────────────
// SUPERVISOR — Listado y filtros
// ──────────────────────────────────────────────────────────────

export async function findTurnos({ fecha, fecha_desde, fecha_hasta, empleado_id, estado, limit = 50 }) {
  const conditions = [];
  const params     = [];
  let   i          = 1;

  // Soporte para rango de fechas (auditoría) o fecha exacta (monitoreo)
  if (fecha_desde && fecha_hasta) {
    conditions.push(`t.fecha_turno >= $${i++}`);  params.push(fecha_desde);
    conditions.push(`t.fecha_turno <= $${i++}`);  params.push(fecha_hasta);
  } else if (fecha) {
    conditions.push(`t.fecha_turno = $${i++}`);  params.push(fecha);
  }

  if (empleado_id) { conditions.push(`t.empleado_id = $${i++}`);  params.push(empleado_id); }
  if (estado && estado !== 'all') {
    conditions.push(`t.estado = $${i++}`);
    params.push(estado);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT t.*,
            u.nombre        AS aprobador_nombre,
            u.apellido      AS aprobador_apellido,
            u.email         AS aprobador_email,
            e.hourly_rate,
            ROUND((COALESCE(t.horas_extras, 0) * COALESCE(e.hourly_rate, 0))::NUMERIC, 2) AS costo_extras,
            ROUND((COALESCE(t.horas_extras_diurnas, 0) * COALESCE(e.hourly_rate, 0) * 0.25)::NUMERIC, 2) AS costo_recargo_diurno,
            ROUND((COALESCE(t.horas_extras_nocturnas, 0) * COALESCE(e.hourly_rate, 0) * 0.75)::NUMERIC, 2) AS costo_recargo_nocturno
     FROM resumen_turnos_tecnicos t
     LEFT JOIN employees e ON e.id = t.empleado_id
     LEFT JOIN users u ON u.id::text = t.aprobado_por
     ${where}
     ORDER BY t.fecha_turno DESC, t.nombre_tecnico ASC
     LIMIT $${i}`,
    [...params, limit]
  );
  return res.rows;
}

export async function resumenSemana(semanaIso) {
  // semanaIso: '2026-W20' → calcular lunes y domingo de esa semana
  const res = await query(
    `SELECT
       e.full_name        AS nombre_tecnico,
       e.id                AS empleado_id,
       e.hourly_rate,
       SUM(t.minutos_extras)                                                 AS total_minutos_extras_semana,
       ROUND(SUM(t.minutos_extras)::NUMERIC / 60, 2)                         AS total_horas_extras_semana,
       COUNT(t.id)                                                           AS total_turnos,
       SUM(t.horas_extras_diurnas)                                           AS total_diurnas,
       SUM(t.horas_extras_nocturnas)                                         AS total_nocturnas,
       BOOL_OR(t.alerta_limite_legal)                                        AS hay_alerta_diaria,
       SUM(t.minutos_extras) > 720                                           AS alerta_limite_semanal,
       ROUND((COALESCE(SUM(t.horas_extras), 0) * COALESCE(e.hourly_rate, 0))::NUMERIC, 2) AS costo_extras_semanal,
       ROUND((COALESCE(SUM(t.horas_extras_diurnas), 0) * COALESCE(e.hourly_rate, 0) * 0.25)::NUMERIC, 2) AS costo_recargo_diurno_semanal,
       ROUND((COALESCE(SUM(t.horas_extras_nocturnas), 0) * COALESCE(e.hourly_rate, 0) * 0.75)::NUMERIC, 2) AS costo_recargo_nocturno_semanal
     FROM turnos_tecnicos t
     JOIN employees e ON e.id = t.empleado_id
     WHERE t.fecha_turno >= date_trunc('week', CURRENT_DATE)
       AND t.fecha_turno <  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
       AND t.estado IN ('CERRADO','CERRADO_AUTO')
     GROUP BY e.id, e.full_name, e.hourly_rate
     ORDER BY total_minutos_extras_semana DESC`,
    []
  );
  return res.rows;
}

export async function aprobarExtras(turnoId, data) {
  const { aprobado, observaciones, userId } = data;
  const res = await query(
    `UPDATE turnos_tecnicos SET
       aprobado_por     = $1,
       fecha_aprobacion = NOW(),
       observaciones    = $2,
       updated_at       = NOW()
     WHERE id = $3 AND estado IN ('CERRADO','CERRADO_AUTO')
     RETURNING *`,
    [userId, observaciones || null, turnoId]
  );
  return res.rows[0];
}

// ──────────────────────────────────────────────────────────────
// REABRIR TURNO
// ──────────────────────────────────────────────────────────────

/**
 * Reabre un turno cerrado. Elimina el desglose previo y
 * limpia los campos de cierre para que el técnico pueda
 * continuar registrando servicios.
 */
export async function reabrirTurno(turnoId, empleadoId) {
  return await withTransaction(async (client) => {
    const turnoRes = await client.query(
      `SELECT * FROM turnos_tecnicos WHERE id = $1 AND empleado_id = $2 FOR UPDATE`,
      [turnoId, empleadoId]
    );
    if (!turnoRes.rows[0]) throw new Error('Turno no encontrado.');

    const turno = turnoRes.rows[0];
    if (!['CERRADO', 'CERRADO_AUTO'].includes(turno.estado)) {
      throw new Error('El turno no está cerrado. No es necesario reabrirlo.');
    }

    // Cerrar servicios pendientes (quedaron en curso cuando se cerró el turno)
    await client.query(
      `UPDATE turno_servicios SET
         estado_servicio = 'COMPLETADO',
         notas_tecnico   = COALESCE(
           NULLIF(notas_tecnico, ''),
           'Cancelado por reapertura de turno'
         ),
         updated_at      = NOW()
       WHERE turno_id = $1 AND estado_servicio != 'COMPLETADO'`,
      [turnoId]
    );

    // Eliminar desglose de recargos previo (se recalculará al cerrar de nuevo)
    await client.query(
      `DELETE FROM turno_minutos_detalle WHERE turno_id = $1`,
      [turnoId]
    );

    // Reabrir: quitar fin_turno, marcar como ACTIVO y resetear desglose CST
    const res = await client.query(
      `UPDATE turnos_tecnicos SET
         estado                = 'ACTIVO',
         fin_turno             = NULL,
         origen_fin            = NULL,
         tiempo_total_min      = NULL,
         minutos_extras        = 0,
         horas_extras          = 0,
         horas_extras_diurnas  = 0,
         horas_extras_nocturnas = 0,
         alerta_limite_legal   = FALSE,
         min_ord_diurnos       = 0,
         min_ord_nocturnos     = 0,
         min_extra_diurnos     = 0,
         min_extra_nocturnos   = 0,
         min_dom_fest_ord      = 0,
         min_dom_fest_extra_d  = 0,
         min_dom_fest_extra_n  = 0,
         es_domingo            = FALSE,
         es_festivo            = FALSE,
         nombre_festivo        = NULL,
         updated_at            = NOW()
       WHERE id = $1 RETURNING *`,
      [turnoId]
    );

    return res.rows[0];
  });
}

// ──────────────────────────────────────────────────────────────
// OTs DISPONIBLES PARA EL TÉCNICO
// ──────────────────────────────────────────────────────────────

export async function findOTsDisponibles(q = '') {
  const search = `%${q.trim()}%`;
  const res = await query(
    `SELECT ot.id, ot.consecutivo, ot.estado, ot.detalle_servicio,
            c.name AS empresa,
            e.marca || ' ' || e.modelo AS equipo,
            e.serial
     FROM ordenes_trabajo ot
     JOIN companies c ON c.id = ot.empresa_id
     JOIN equipos   e ON e.id = ot.equipo_id
     WHERE ot.deleted_at IS NULL
       AND ot.estado IN ('ABIERTA','EN_PROCESO')
       AND (
         ot.consecutivo ILIKE $1
         OR c.name ILIKE $1
         OR e.marca ILIKE $1
         OR e.modelo ILIKE $1
         OR e.serial ILIKE $1
         OR ot.detalle_servicio ILIKE $1
       )
     ORDER BY ot.created_at DESC
     LIMIT 30`,
    [search]
  );
  return res.rows;
}

// ──────────────────────────────────────────────────────────────
// JOB NOCTURNO: cierre automático de turnos
// ──────────────────────────────────────────────────────────────

/**
 * Cierra todos los turnos en estado ACTIVO de días anteriores.
 * Se llama desde el job node-cron a las 23:59.
 */
export async function cerrarTurnosActivos() {
  const hoy = new Date().toISOString().split('T')[0];

  const turnosRes = await query(
    `SELECT id FROM turnos_tecnicos
     WHERE estado = 'ACTIVO' AND fecha_turno < $1`,
    [hoy]
  );

  const config = await getConfig();

  let cerrados = 0;
  for (const { id } of turnosRes.rows) {
    try {
      await withTransaction(async (client) => {
        const turnoRes = await client.query(
          `SELECT * FROM turnos_tecnicos WHERE id = $1 FOR UPDATE`,
          [id]
        );
        const turno = turnoRes.rows[0];
        if (!turno || turno.estado !== 'ACTIVO') return;

        // Calcular fin de turno como las 23:59 del día del turno
        const finAuto = new Date(`${turno.fecha_turno}T23:59:00`);

        let calc = { completo: false };
        if (turno.inicio_turno) {
          calc = await calcularDesgloseCompleto(
            { inicio_turno: turno.inicio_turno, fin_turno: finAuto, fecha_turno: turno.fecha_turno },
            config
          );
        }

        // Guardar desglose minuto a minuto
        if (calc.completo && calc.desgloseBloques?.length > 0) {
          for (const bloque of calc.desgloseBloques) {
            await client.query(
              `INSERT INTO turno_minutos_detalle
                 (turno_id, recargo_codigo, hora_inicio, hora_fin, minutos,
                  es_extra, es_dominical_festivo, porcentaje_recargo, total_pct)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                id,
                bloque.recargo_codigo,
                bloque.inicio,
                bloque.fin,
                bloque.minutos,
                bloque.es_extra,
                bloque.es_dominical_festivo,
                bloque.porcentaje_recargo,
                bloque.total_pct,
              ]
            );
          }
        }

        await client.query(
          `UPDATE turnos_tecnicos SET
             estado                = 'CERRADO_AUTO',
             fin_turno             = $1,
             tiempo_total_min      = $2,
             minutos_extras        = $3,
             horas_extras          = $4,
             horas_extras_diurnas  = $5,
             horas_extras_nocturnas = $6,
             alerta_limite_legal   = $7,
             min_ord_diurnos       = $8,
             min_ord_nocturnos     = $9,
             min_extra_diurnos     = $10,
             min_extra_nocturnos   = $11,
             min_dom_fest_ord      = $12,
             min_dom_fest_extra_d  = $13,
             min_dom_fest_extra_n  = $14,
             es_domingo            = $15,
             es_festivo            = $16,
             nombre_festivo        = $17,
             updated_at            = NOW()
           WHERE id = $18`,
          [
            finAuto,
            calc.completo ? calc.tiempoTotalMin         : null,
            calc.completo ? calc.minutosExtras          : 0,
            calc.completo ? calc.horasExtras            : 0,
            calc.completo ? calc.horasExtrasDiurnas     : 0,
            calc.completo ? calc.horasExtrasNocturnas   : 0,
            calc.completo ? calc.alertaLimiteLegal      : false,
            calc.completo ? calc.min_ord_diurnos      || 0 : 0,
            calc.completo ? calc.min_ord_nocturnos    || 0 : 0,
            calc.completo ? calc.min_extra_diurnos    || 0 : 0,
            calc.completo ? calc.min_extra_nocturnos  || 0 : 0,
            calc.completo ? calc.min_dom_fest_ord     || 0 : 0,
            calc.completo ? calc.min_dom_fest_extra_d || 0 : 0,
            calc.completo ? calc.min_dom_fest_extra_n || 0 : 0,
            calc.completo ? calc.esDomingo            || false : false,
            calc.completo ? calc.esFestivo            || false : false,
            calc.completo ? calc.nombreFestivo        || null : null,
            id,
          ]
        );
      });
      cerrados++;
    } catch (err) {
      console.error(`[TurnoJob] Error cerrando turno ${id}:`, err.message);
    }
  }

  return { cerrados };
}
