import { query, withTransaction } from '../../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { registrarMovimiento } from '../../services/inventoryMovements.service.js';

// ─── HELPERS ────────────────────────────────────────────────────

function mapRows(rows) {
  return rows?.map(r => ({ ...r })) ?? [];
}

function firstRow(rows) {
  return rows?.[0] ?? null;
}

const db = { query };

/**
 * Ejecuta queries usando el cliente de transacción si se provee,
 * o el pool por defecto si no.
 */
function getExecutor(client) {
  return client || db;
}

// ─── PLANES ─────────────────────────────────────────────────────

export async function getPlanes(filters = {}) {
  let sql = 'SELECT * FROM mp_planes_mantenimiento WHERE 1=1';
  const params = [];
  let idx = 1;

  if (filters.tipo_entidad) {
    sql += ` AND tipo_entidad = $${idx++}`;
    params.push(filters.tipo_entidad);
  }
  if (filters.activo !== undefined) {
    sql += ` AND activo = $${idx++}`;
    params.push(filters.activo === 'true' || filters.activo === true);
  }
  if (filters.prioridad) {
    sql += ` AND prioridad = $${idx++}`;
    params.push(filters.prioridad);
  }
  if (filters.search) {
    sql += ` AND (nombre ILIKE $${idx} OR codigo ILIKE $${idx} OR descripcion ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  sql += ' ORDER BY created_at DESC';
  const result = await query(sql, params);
  return mapRows(result.rows);
}

export async function getPlanById(id, client = null) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || String(numId) !== String(id)) {
    throw new NotFoundError('Plan de mantenimiento');
  }

  const exec = getExecutor(client);
  const plan = firstRow((await exec.query(
    `SELECT p.*,
            TRIM(u.nombre || ' ' || COALESCE(u.apellido, '')) as responsable_nombre,
            TRIM(u2.nombre || ' ' || COALESCE(u2.apellido, '')) as creador_nombre
     FROM mp_planes_mantenimiento p
     LEFT JOIN users u ON p.responsable_id = u.id
     LEFT JOIN users u2 ON p.created_by = u2.id
     WHERE p.id = $1`,
    [numId]
  )).rows);
  if (!plan) throw new NotFoundError('Plan de mantenimiento');

  const [actividades, insumos] = await Promise.all([
    exec.query('SELECT * FROM mp_actividades_plan WHERE plan_id = $1 ORDER BY orden', [numId]),
    exec.query('SELECT * FROM mp_insumos_plan WHERE plan_id = $1', [numId]),
  ]);

  plan.actividades = mapRows(actividades.rows);
  plan.insumos = mapRows(insumos.rows);
  return plan;
}

export async function getPlanConDetalles(id) {
  return getPlanById(id);
}

export async function createPlan(data, userId) {
  const { nombre, descripcion, tipo_entidad, equipo_id, area_id, tipo_mantenimiento,
          frecuencia_tipo, frecuencia_valor, duracion_estimada_horas, prioridad,
          responsable_id, fecha_inicio_vigencia, fecha_fin_vigencia, observaciones,
          actividades, insumos } = data;

  if (!nombre || !tipo_entidad || !tipo_mantenimiento || !frecuencia_tipo) {
    throw new BadRequestError('nombre, tipo_entidad, tipo_mantenimiento y frecuencia_tipo son requeridos');
  }

  if (tipo_entidad === 'EQUIPO' && !equipo_id) {
    throw new BadRequestError('Debes seleccionar un equipo cuando el tipo de entidad es EQUIPO');
  }
  if (tipo_entidad === 'AREA' && !area_id) {
    throw new BadRequestError('Debes seleccionar un área cuando el tipo de entidad es AREA');
  }

  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO mp_planes_mantenimiento
       (nombre, descripcion, tipo_entidad, equipo_id, area_id, tipo_mantenimiento,
        frecuencia_tipo, frecuencia_valor, duracion_estimada_horas, prioridad,
        responsable_id, fecha_inicio_vigencia, fecha_fin_vigencia, observaciones, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [nombre, descripcion, tipo_entidad, equipo_id || null, area_id || null,
       tipo_mantenimiento, frecuencia_tipo, frecuencia_valor || null,
       duracion_estimada_horas || null, prioridad || 'MEDIA', responsable_id || null,
       fecha_inicio_vigencia || new Date(), fecha_fin_vigencia || null,
       observaciones || null, userId]
    );
    const plan = result.rows[0];

    // Insertar actividades
    if (Array.isArray(actividades) && actividades.length > 0) {
      for (let i = 0; i < actividades.length; i++) {
        const a = actividades[i];
        await client.query(
          `INSERT INTO mp_actividades_plan (plan_id, orden, descripcion, obligatoria, tiempo_estimado_min)
           VALUES ($1, $2, $3, $4, $5)`,
          [plan.id, i + 1, a.descripcion, a.obligatoria !== false, a.tiempo_estimado_min || null]
        );
      }
    }

    // Insertar insumos
    if (Array.isArray(insumos) && insumos.length > 0) {
      for (const ins of insumos) {
        await client.query(
          `INSERT INTO mp_insumos_plan (plan_id, producto_id, descripcion_libre, cantidad, unidad)
           VALUES ($1, $2, $3, $4, $5)`,
          [plan.id, ins.producto_id || null, ins.descripcion_libre || null, ins.cantidad, ins.unidad || null]
        );
      }
    }

    return getPlanById(plan.id, client);
  });
}

export async function updatePlan(id, data, userId) {
  const plan = await getPlanById(id);

  if (data.tipo_entidad && data.tipo_entidad !== plan.tipo_entidad) {
    if (data.tipo_entidad === 'EQUIPO' && !data.equipo_id) {
      throw new BadRequestError('Debes seleccionar un equipo cuando el tipo de entidad es EQUIPO');
    }
    if (data.tipo_entidad === 'AREA' && !data.area_id) {
      throw new BadRequestError('Debes seleccionar un área cuando el tipo de entidad es AREA');
    }
  }

  return withTransaction(async (client) => {
    const { nombre, descripcion, tipo_entidad, equipo_id, area_id, tipo_mantenimiento,
            frecuencia_tipo, frecuencia_valor, duracion_estimada_horas, prioridad,
            responsable_id, fecha_inicio_vigencia, fecha_fin_vigencia, observaciones,
            actividades, insumos } = data;

    await client.query(
      `UPDATE mp_planes_mantenimiento SET
        nombre = $1, descripcion = $2, tipo_entidad = $3, equipo_id = $4, area_id = $5,
        tipo_mantenimiento = $6, frecuencia_tipo = $7, frecuencia_valor = $8,
        duracion_estimada_horas = $9, prioridad = $10, responsable_id = $11,
        fecha_inicio_vigencia = $12, fecha_fin_vigencia = $13, observaciones = $14
       WHERE id = $15`,
      [nombre || plan.nombre, descripcion ?? plan.descripcion,
       tipo_entidad || plan.tipo_entidad, equipo_id !== undefined ? equipo_id : plan.equipo_id,
       area_id !== undefined ? area_id : plan.area_id,
       tipo_mantenimiento || plan.tipo_mantenimiento,
       frecuencia_tipo || plan.frecuencia_tipo,
       frecuencia_valor !== undefined ? frecuencia_valor : plan.frecuencia_valor,
       duracion_estimada_horas !== undefined ? duracion_estimada_horas : plan.duracion_estimada_horas,
       prioridad || plan.prioridad,
       responsable_id !== undefined ? responsable_id : plan.responsable_id,
       fecha_inicio_vigencia || plan.fecha_inicio_vigencia,
       fecha_fin_vigencia !== undefined ? fecha_fin_vigencia : plan.fecha_fin_vigencia,
       observaciones !== undefined ? observaciones : plan.observaciones,
       id]
    );

    // Reemplazar actividades
    if (Array.isArray(actividades)) {
      await client.query('DELETE FROM mp_actividades_plan WHERE plan_id = $1', [id]);
      for (let i = 0; i < actividades.length; i++) {
        const a = actividades[i];
        await client.query(
          `INSERT INTO mp_actividades_plan (plan_id, orden, descripcion, obligatoria, tiempo_estimado_min)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, i + 1, a.descripcion, a.obligatoria !== false, a.tiempo_estimado_min || null]
        );
      }
    }

    // Reemplazar insumos
    if (Array.isArray(insumos)) {
      await client.query('DELETE FROM mp_insumos_plan WHERE plan_id = $1', [id]);
      for (const ins of insumos) {
        await client.query(
          `INSERT INTO mp_insumos_plan (plan_id, producto_id, descripcion_libre, cantidad, unidad)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, ins.producto_id || null, ins.descripcion_libre || null, ins.cantidad, ins.unidad || null]
        );
      }
    }

    return getPlanById(id, client);
  });
}

export async function togglePlan(id) {
  const plan = await getPlanById(id);
  const nuevoEstado = !plan.activo;
  await query('UPDATE mp_planes_mantenimiento SET activo = $1 WHERE id = $2', [nuevoEstado, id]);
  return { ...plan, activo: nuevoEstado };
}

export async function deletePlan(id) {
  const plan = await getPlanById(id);

  // Verificar que no tenga órdenes activas
  const ordenes = await query(
    `SELECT id FROM mp_ordenes_mantenimiento
     WHERE plan_id = $1 AND estado IN ('PROGRAMADO', 'EN_EJECUCION') LIMIT 1`,
    [id]
  );
  if (ordenes.rows.length > 0) {
    throw new BadRequestError('No se puede eliminar el plan porque tiene órdenes activas (Programadas o En Ejecución)');
  }

  await query('DELETE FROM mp_planes_mantenimiento WHERE id = $1', [id]);
  return { message: 'Plan eliminado exitosamente' };
}

export async function generarOrdenDesdePlan(planId, userId) {
  const plan = await getPlanConDetalles(planId);
  if (!plan.activo) throw new BadRequestError('El plan está inactivo');

  const fechaProgramada = calcularProximaFecha(plan);

  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO mp_ordenes_mantenimiento
       (plan_id, tipo_entidad, equipo_id, area_id, tipo_mantenimiento,
        titulo, descripcion, fecha_programada, prioridad, responsable_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [plan.id, plan.tipo_entidad, plan.equipo_id, plan.area_id,
       plan.tipo_mantenimiento, plan.nombre, plan.descripcion,
       fechaProgramada, plan.prioridad, plan.responsable_id, userId]
    );
    const orden = result.rows[0];

    // Snapshot actividades
    for (const act of plan.actividades) {
      await client.query(
        `INSERT INTO mp_actividades_orden (orden_id, actividad_plan_id, orden, descripcion, obligatoria)
         VALUES ($1, $2, $3, $4, $5)`,
        [orden.id, act.id, act.orden, act.descripcion, act.obligatoria]
      );
    }

    // Snapshot insumos
    for (const ins of plan.insumos) {
      await client.query(
        `INSERT INTO mp_insumos_orden (orden_id, producto_id, descripcion_libre, cantidad_planificada, unidad)
         VALUES ($1, $2, $3, $4, $5)`,
        [orden.id, ins.producto_id, ins.descripcion_libre, ins.cantidad, ins.unidad]
      );
    }

    // Bitácora inicial
    await client.query(
      `INSERT INTO mp_bitacora (orden_id, estado_nuevo, comentario, usuario_id)
       VALUES ($1, 'PROGRAMADO', $2, $3)`,
      [orden.id, `Orden generada desde plan ${plan.codigo}`, userId]
    );

    return orden;
  });
}

function calcularProximaFecha(plan) {
  if (plan.frecuencia_tipo === 'MANUAL') {
    return new Date().toISOString().split('T')[0];
  }

  const hoy = new Date();
  switch (plan.frecuencia_tipo) {
    case 'DIAS':
      hoy.setDate(hoy.getDate() + (plan.frecuencia_valor || 30));
      break;
    case 'SEMANAS':
      hoy.setDate(hoy.getDate() + ((plan.frecuencia_valor || 4) * 7));
      break;
    case 'MESES':
      hoy.setMonth(hoy.getMonth() + (plan.frecuencia_valor || 1));
      break;
    case 'HORAS':
      // Para HORAS, usamos fecha actual + 7 días por defecto
      // El horómetro se maneja en la orden al completarse
      hoy.setDate(hoy.getDate() + 7);
      break;
    default:
      break;
  }
  return hoy.toISOString().split('T')[0];
}

// ─── ÓRDENES ────────────────────────────────────────────────────

export async function getOrdenes(filters = {}) {
  let sql = 'SELECT * FROM mp_ordenes_mantenimiento WHERE 1=1';
  const params = [];
  let idx = 1;

  if (filters.estado) {
    sql += ` AND estado = $${idx++}`;
    params.push(filters.estado);
  }
  if (filters.tipo_mantenimiento) {
    sql += ` AND tipo_mantenimiento = $${idx++}`;
    params.push(filters.tipo_mantenimiento);
  }
  if (filters.equipo_id) {
    sql += ` AND equipo_id = $${idx++}`;
    params.push(filters.equipo_id);
  }
  if (filters.area_id) {
    sql += ` AND area_id = $${idx++}`;
    params.push(parseInt(filters.area_id));
  }
  if (filters.prioridad) {
    sql += ` AND prioridad = $${idx++}`;
    params.push(filters.prioridad);
  }
  if (filters.fecha_desde) {
    sql += ` AND fecha_programada >= $${idx++}`;
    params.push(filters.fecha_desde);
  }
  if (filters.fecha_hasta) {
    sql += ` AND fecha_programada <= $${idx++}`;
    params.push(filters.fecha_hasta);
  }
  if (filters.search) {
    sql += ` AND (titulo ILIKE $${idx} OR codigo ILIKE $${idx} OR descripcion ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  sql += ' ORDER BY fecha_programada DESC, created_at DESC';
  const result = await query(sql, params);
  return mapRows(result.rows);
}

export async function getOrdenById(id, client = null) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || String(numId) !== String(id)) {
    throw new NotFoundError('Orden de mantenimiento');
  }

  const exec = getExecutor(client);
  const orden = firstRow((await exec.query(
    `SELECT o.*,
            TRIM(u.nombre || ' ' || COALESCE(u.apellido, '')) as responsable_nombre,
            TRIM(u2.nombre || ' ' || COALESCE(u2.apellido, '')) as creador_nombre
     FROM mp_ordenes_mantenimiento o
     LEFT JOIN users u ON o.responsable_id = u.id
     LEFT JOIN users u2 ON o.created_by = u2.id
     WHERE o.id = $1`,
    [numId]
  )).rows);
  if (!orden) throw new NotFoundError('Orden de mantenimiento');

  const [actividades, insumos, evidencias, bitacora] = await Promise.all([
    exec.query('SELECT * FROM mp_actividades_orden WHERE orden_id = $1 ORDER BY orden', [numId]),
    exec.query('SELECT * FROM mp_insumos_orden WHERE orden_id = $1', [numId]),
    exec.query('SELECT * FROM mp_evidencias WHERE orden_id = $1', [numId]),
    exec.query('SELECT * FROM mp_bitacora WHERE orden_id = $1 ORDER BY created_at DESC', [numId]),
  ]);

  orden.actividades = mapRows(actividades.rows);
  orden.insumos = mapRows(insumos.rows);
  orden.evidencias = mapRows(evidencias.rows);
  orden.bitacora = mapRows(bitacora.rows);
  return orden;
}

export async function createOrden(data, userId) {
  const { tipo_entidad, equipo_id, area_id, tipo_mantenimiento, titulo, descripcion,
          fecha_programada, prioridad, responsable_id, ejecutado_por, observaciones,
          requiere_paro, actividades, insumos } = data;

  if (!tipo_entidad || !tipo_mantenimiento || !titulo || !fecha_programada) {
    throw new BadRequestError('tipo_entidad, tipo_mantenimiento, titulo y fecha_programada son requeridos');
  }

  if (tipo_entidad === 'EQUIPO' && !equipo_id) {
    throw new BadRequestError('Debes seleccionar un equipo cuando el tipo de entidad es EQUIPO');
  }
  if (tipo_entidad === 'AREA' && !area_id) {
    throw new BadRequestError('Debes seleccionar un área cuando el tipo de entidad es AREA');
  }

  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO mp_ordenes_mantenimiento
       (tipo_entidad, equipo_id, area_id, tipo_mantenimiento, titulo, descripcion,
        fecha_programada, prioridad, responsable_id, ejecutado_por, observaciones,
        requiere_paro, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [tipo_entidad, equipo_id || null, area_id || null, tipo_mantenimiento, titulo,
       descripcion || null, fecha_programada, prioridad || 'MEDIA', responsable_id || null,
       ejecutado_por || null, observaciones || null, requiere_paro || false, userId]
    );
    const orden = result.rows[0];

    if (Array.isArray(actividades) && actividades.length > 0) {
      for (let i = 0; i < actividades.length; i++) {
        const a = actividades[i];
        await client.query(
          `INSERT INTO mp_actividades_orden (orden_id, orden, descripcion, obligatoria)
           VALUES ($1, $2, $3, $4)`,
          [orden.id, i + 1, a.descripcion, a.obligatoria !== false]
        );
      }
    }

    if (Array.isArray(insumos) && insumos.length > 0) {
      for (const ins of insumos) {
        await client.query(
          `INSERT INTO mp_insumos_orden (orden_id, producto_id, descripcion_libre, cantidad_planificada, unidad)
           VALUES ($1, $2, $3, $4, $5)`,
          [orden.id, ins.producto_id || null, ins.descripcion_libre || null, ins.cantidad || 0, ins.unidad || null]
        );
      }
    }

    // Bitácora inicial
    await client.query(
      `INSERT INTO mp_bitacora (orden_id, estado_nuevo, comentario, usuario_id)
       VALUES ($1, 'PROGRAMADO', 'Orden creada manualmente', $2)`,
      [orden.id, userId]
    );

    return orden;
  });
}

export async function updateOrden(id, data) {
  const orden = await getOrdenById(id);

  if (orden.estado === 'VERIFICADO' || orden.estado === 'CANCELADO') {
    throw new BadRequestError('No se puede editar una orden en estado VERIFICADO o CANCELADO');
  }

  if (data.tipo_entidad && data.tipo_entidad !== orden.tipo_entidad) {
    if (data.tipo_entidad === 'EQUIPO' && !data.equipo_id) {
      throw new BadRequestError('Debes seleccionar un equipo cuando el tipo de entidad es EQUIPO');
    }
    if (data.tipo_entidad === 'AREA' && !data.area_id) {
      throw new BadRequestError('Debes seleccionar un área cuando el tipo de entidad es AREA');
    }
  }

  return withTransaction(async (client) => {
    const { titulo, descripcion, fecha_programada, prioridad, responsable_id,
            ejecutado_por, observaciones, requiere_paro, actividades, insumos } = data;

    await client.query(
      `UPDATE mp_ordenes_mantenimiento SET
        titulo = $1, descripcion = $2, fecha_programada = $3, prioridad = $4,
        responsable_id = $5, ejecutado_por = $6, observaciones = $7, requiere_paro = $8
       WHERE id = $9`,
      [titulo || orden.titulo, descripcion ?? orden.descripcion,
       fecha_programada || orden.fecha_programada, prioridad || orden.prioridad,
       responsable_id !== undefined ? responsable_id : orden.responsable_id,
       ejecutado_por !== undefined ? ejecutado_por : orden.ejecutado_por,
       observaciones !== undefined ? observaciones : orden.observaciones,
       requiere_paro !== undefined ? requiere_paro : orden.requiere_paro, id]
    );

    if (Array.isArray(actividades)) {
      await client.query('DELETE FROM mp_actividades_orden WHERE orden_id = $1', [id]);
      for (let i = 0; i < actividades.length; i++) {
        const a = actividades[i];
        await client.query(
          `INSERT INTO mp_actividades_orden (orden_id, orden, descripcion, obligatoria)
           VALUES ($1, $2, $3, $4)`,
          [id, i + 1, a.descripcion, a.obligatoria !== false]
        );
      }
    }

    if (Array.isArray(insumos)) {
      await client.query('DELETE FROM mp_insumos_orden WHERE orden_id = $1', [id]);
      for (const ins of insumos) {
        await client.query(
          `INSERT INTO mp_insumos_orden (orden_id, producto_id, descripcion_libre, cantidad_planificada, unidad)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, ins.producto_id || null, ins.descripcion_libre || null, ins.cantidad || 0, ins.unidad || null]
        );
      }
    }

    return getOrdenById(id, client);
  });
}

// ─── MÁQUINA DE ESTADOS ─────────────────────────────────────────

const TRANSICIONES = {
  PROGRAMADO:    ['EN_EJECUCION', 'CANCELADO', 'POSPUESTO'],
  EN_EJECUCION:  ['COMPLETADO', 'POSPUESTO', 'CANCELADO'],
  COMPLETADO:    ['VERIFICADO', 'EN_EJECUCION'],
  VERIFICADO:    [],
  POSPUESTO:     ['PROGRAMADO', 'CANCELADO'],
  CANCELADO:     [],
};

// Transiciones que requieren rol Admin/Supervisor
const TRANSICIONES_REQUIERE_ADMIN = {
  COMPLETADO: ['VERIFICADO', 'EN_EJECUCION'],
};

// Roles que pueden ejecutar transiciones restringidas
const ROLES_ADMIN = ['admin', 'supervisor'];

export async function cambiarEstadoOrden(id, { estado_nuevo, comentario }, userId, userRole) {
  const orden = await getOrdenById(id);
  const transicionesPermitidas = TRANSICIONES[orden.estado];

  if (!transicionesPermitidas || !transicionesPermitidas.includes(estado_nuevo)) {
    throw new BadRequestError(
      `Transición no permitida: de ${orden.estado} a ${estado_nuevo}. Permitidas: ${(transicionesPermitidas || []).join(', ') || 'ninguna'}`
    );
  }

  // Validar rol para transiciones restringidas
  const restringidas = TRANSICIONES_REQUIERE_ADMIN[orden.estado] || [];
  if (restringidas.includes(estado_nuevo) && !ROLES_ADMIN.includes(userRole)) {
    throw new ForbiddenError('Solo administradores o supervisores pueden realizar esta transición');
  }

  // Validar actividades obligatorias para COMPLETADO
  if (estado_nuevo === 'COMPLETADO') {
    const obligatoriasSinCompletar = orden.actividades.filter(
      a => a.obligatoria && !a.completada
    );
    if (obligatoriasSinCompletar.length > 0) {
      throw new BadRequestError(
        `No se puede completar la orden: hay ${obligatoriasSinCompletar.length} actividad(es) obligatoria(s) sin completar`
      );
    }
  }

  return withTransaction(async (client) => {
    // Actualizar campos según estado
    const updates = { estado: estado_nuevo };
    if (estado_nuevo === 'EN_EJECUCION') {
      updates.fecha_inicio_real = new Date();
    } else if (estado_nuevo === 'COMPLETADO') {
      updates.fecha_fin_real = new Date();
      if (orden.fecha_inicio_real) {
        const diffMs = new Date(updates.fecha_fin_real) - new Date(orden.fecha_inicio_real);
        updates.duracion_real_horas = Math.round(diffMs / (1000 * 60 * 60) * 100) / 100;
      }

      // ── Generar movimientos de inventario por insumos usados ────
      for (const insumo of orden.insumos) {
        if (insumo.producto_id && parseFloat(insumo.cantidad_usada || 0) > 0) {
          try {
            const mov = await registrarMovimiento({
              inventario_id: insumo.producto_id,
              tipo_movimiento: 'SALIDA_MANTENIMIENTO',
              tipo_documento: 'SALIDA',
              numero_documento: orden.codigo,
              cantidad: parseFloat(insumo.cantidad_usada),
              notas: `Mantenimiento ${orden.codigo} - ${orden.titulo}`,
              registrado_por: userId,
            }, client);

            // Guardar referencia del movimiento
            await client.query(
              `UPDATE mp_insumos_orden SET movimiento_inventario_id = $1 WHERE id = $2`,
              [mov.movimiento.id, insumo.id]
            );
          } catch (err) {
            // Si falla un movimiento, hacemos rollback de toda la transacción
            throw new BadRequestError(
              `Error al registrar salida de inventario para el insumo #${insumo.id}: ${err.message}`
            );
          }
        }
      }
    }

    await client.query(
      `UPDATE mp_ordenes_mantenimiento
       SET estado = $1, fecha_inicio_real = COALESCE($2, fecha_inicio_real),
           fecha_fin_real = COALESCE($3, fecha_fin_real),
           duracion_real_horas = COALESCE($4, duracion_real_horas),
           costo_insumos = COALESCE($5, costo_insumos)
       WHERE id = $6`,
      [updates.estado, updates.fecha_inicio_real || null, updates.fecha_fin_real || null,
       updates.duracion_real_horas || null, updates.costo_insumos || null, id]
    );

    // Bitácora
    await client.query(
      `INSERT INTO mp_bitacora (orden_id, estado_anterior, estado_nuevo, comentario, usuario_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, orden.estado, estado_nuevo, comentario || null, userId]
    );

    return getOrdenById(id, client);
  });
}

// ─── ACTIVIDADES DE LA ORDEN ─────────────────────────────────

export async function completarActividad(ordenId, actividadId, data, userId) {
  const { completada, observacion } = data;

  const actRows = await query(
    'SELECT * FROM mp_actividades_orden WHERE id = $1 AND orden_id = $2',
    [actividadId, ordenId]
  );
  if (actRows.rows.length === 0) throw new NotFoundError('Actividad');

  if (completada) {
    await query(
      `UPDATE mp_actividades_orden
       SET completada = true, completada_at = NOW(), completada_por = $1, observacion = $2
       WHERE id = $3`,
      [userId, observacion || null, actividadId]
    );
  } else {
    await query(
      `UPDATE mp_actividades_orden
       SET completada = false, completada_at = NULL, completada_por = NULL, observacion = $1
       WHERE id = $2`,
      [observacion || null, actividadId]
    );
  }

  return getOrdenById(ordenId);
}

// ─── EVIDENCIAS ──────────────────────────────────────────────

export async function subirEvidencia(ordenId, file, descripcion, userId) {
  if (!file) throw new BadRequestError('Archivo requerido');

  const result = await query(
    `INSERT INTO mp_evidencias (orden_id, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes, descripcion, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [ordenId, file.originalname, file.path, file.mimetype, file.size, descripcion || null, userId]
  );
  return result.rows[0];
}

export async function eliminarEvidencia(ordenId, evidenciaId) {
  const evRows = await query(
    'SELECT * FROM mp_evidencias WHERE id = $1 AND orden_id = $2',
    [evidenciaId, ordenId]
  );
  if (evRows.rows.length === 0) throw new NotFoundError('Evidencia');
  await query('DELETE FROM mp_evidencias WHERE id = $1', [evidenciaId]);
  return { message: 'Evidencia eliminada' };
}

// ─── BITÁCORA ────────────────────────────────────────────────

export async function getBitacora(ordenId) {
  const numId = parseInt(ordenId, 10);
  if (isNaN(numId) || String(numId) !== String(ordenId)) {
    throw new NotFoundError('Orden de mantenimiento');
  }

  const result = await query(
    'SELECT * FROM mp_bitacora WHERE orden_id = $1 ORDER BY created_at DESC',
    [numId]
  );
  return mapRows(result.rows);
}

// ─── CALENDARIO ──────────────────────────────────────────────

export async function getCalendario(year, month) {
  const yearNum = parseInt(year) || new Date().getFullYear();
  const monthNum = parseInt(month) || new Date().getMonth() + 1;

  const result = await query(
    `SELECT id, codigo, titulo, tipo_mantenimiento, estado, prioridad, fecha_programada,
            equipo_id, area_id, responsable_id
     FROM mp_ordenes_mantenimiento
     WHERE EXTRACT(YEAR FROM fecha_programada) = $1
       AND EXTRACT(MONTH FROM fecha_programada) = $2
     ORDER BY fecha_programada`,
    [yearNum, monthNum]
  );
  return mapRows(result.rows);
}

// ─── HISTORIAL ───────────────────────────────────────────────

export async function getHistorialEquipo(equipoId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(equipoId)) {
    throw new NotFoundError('Equipo');
  }

  const result = await query(
    `SELECT o.*, p.nombre as plan_nombre, p.codigo as plan_codigo
     FROM mp_ordenes_mantenimiento o
     LEFT JOIN mp_planes_mantenimiento p ON o.plan_id = p.id
     WHERE o.equipo_id = $1
     ORDER BY o.fecha_programada DESC`,
    [equipoId]
  );
  return mapRows(result.rows);
}

export async function getHistorialArea(areaId) {
  const numId = parseInt(areaId, 10);
  if (isNaN(numId) || String(numId) !== String(areaId)) {
    throw new NotFoundError('Área');
  }

  const result = await query(
    `SELECT o.*, p.nombre as plan_nombre, p.codigo as plan_codigo
     FROM mp_ordenes_mantenimiento o
     LEFT JOIN mp_planes_mantenimiento p ON o.plan_id = p.id
     WHERE o.area_id = $1
     ORDER BY o.fecha_programada DESC`,
    [numId]
  );
  return mapRows(result.rows);
}

// ─── KPIs ─────────────────────────────────────────────────────

export async function getKpis() {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split('T')[0];

  const [estados, costoMes, cumplimiento, totales] = await Promise.all([
    query(`
      SELECT estado, COUNT(*)::int as cantidad
      FROM mp_ordenes_mantenimiento
      GROUP BY estado
      ORDER BY estado
    `),
    query(`
      SELECT COALESCE(SUM(costo_total), 0) as total_costo
      FROM mp_ordenes_mantenimiento
      WHERE fecha_programada >= $1 AND fecha_programada <= $2
        AND estado IN ('COMPLETADO', 'VERIFICADO')
    `, [inicioMes, finMes]),
    query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE estado IN ('COMPLETADO','VERIFICADO'))::int as completadas,
        ROUND(
          COUNT(*) FILTER (WHERE estado IN ('COMPLETADO','VERIFICADO'))::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ) as porcentaje
      FROM mp_ordenes_mantenimiento
      WHERE fecha_programada >= $1 AND fecha_programada <= $2
    `, [inicioMes, finMes]),
    query(`
      SELECT COUNT(*)::int as total_ordenes,
             COUNT(*) FILTER (WHERE plan_id IS NOT NULL)::int as desde_plan,
             COUNT(*) FILTER (WHERE plan_id IS NULL)::int as manuales
      FROM mp_ordenes_mantenimiento
    `),
  ]);

  return {
    ordenes_por_estado: mapRows(estados.rows),
    costo_mes_actual: costoMes.rows[0]?.total_costo || 0,
    cumplimiento: cumplimiento.rows[0] || { total: 0, completadas: 0, porcentaje: 0 },
    totales: totales.rows[0] || { total_ordenes: 0, desde_plan: 0, manuales: 0 },
  };
}
