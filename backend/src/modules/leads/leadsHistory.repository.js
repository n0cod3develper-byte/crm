import { query } from '../../config/database.js';

/**
 * Etiquetas en español de los campos comerciales del lead.
 * Solo cubre campos que REALMENTE existen en la tabla `leads`.
 * (No hay prioridad, fecha de seguimiento ni motivo de cierre: no se inventan.)
 */
export const ETIQUETAS_CAMPO = {
  first_name: 'Nombre del contacto',
  last_name: 'Apellido del contacto',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  company_name: 'Cliente / Empresa',
  source: 'Fuente',
  campaign_id: 'Campaña',
  status: 'Estado',
  score: 'Puntaje',
  notes: 'Descripción / Requerimiento',
  assigned_employee_id: 'Asignado a',
  deleted_at: 'Archivado',
};

/** Estados terminales del lead: se consideran cierre comercial. */
export const ESTADOS_CIERRE = ['dead', 'converted'];

/** Campos comerciales auditables (excluye ids técnicos y fechas). */
export const CAMPOS_AUDITABLES = [
  'first_name', 'last_name', 'email', 'phone', 'company_name',
  'source', 'campaign_id', 'status', 'score', 'notes',
];

/**
 * Compara dos snapshots del lead y devuelve un evento por campo que CAMBIÓ de verdad.
 * Trata null y '' como equivalentes, de modo que un guardado sin cambios reales
 * no genera eventos ni ruido en la línea de tiempo.
 */
export function diffLead(antes, despues) {
  const eventos = [];
  for (const campo of CAMPOS_AUDITABLES) {
    const a = normalizar(antes[campo]);
    const b = normalizar(despues[campo]);
    if (a !== b) {
      eventos.push({
        eventType: 'MODIFICACION',
        fieldName: campo,
        oldValue: a === null ? null : String(a),
        newValue: b === null ? null : String(b),
      });
    }
  }
  return eventos;
}

function normalizar(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  return String(valor);
}

export class LeadsHistoryRepository {
  /**
   * Registra un evento de trazabilidad.
   * Recibe opcionalmente un `client` de transacción: cuando se pasa, el evento se
   * persiste EN LA MISMA transacción que modifica el lead. Si el INSERT falla,
   * la transacción entera —incluida la modificación del lead— se revierte, tal
   * como exige la regla de "sin cambios sin trazabilidad".
   */
  async registrar(e, client = null) {
    const sql = `
      INSERT INTO lead_history
        (lead_id, event_type, field_name, old_value, new_value, description, nota,
         performed_by_user_id, performed_by_name,
         assigned_employee_id, assigned_employee_name, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id`;

    const params = [
      e.leadId,
      e.eventType,
      e.fieldName || null,
      e.oldValue ?? null,
      e.newValue ?? null,
      e.description || null,
      e.nota ? String(e.nota).trim() : null,
      e.performedByUserId || null,
      e.performedByName || null,
      e.assignedEmployeeId || null,
      e.assignedEmployeeName || null,
      e.metadata ? JSON.stringify(e.metadata) : null,
    ];

    const r = client ? await client.query(sql, params) : await query(sql, params);
    return r.rows[0]?.id ?? null;
  }

  /**
   * Línea de tiempo paginada, de más reciente a más antigua, con criterio
   * secundario estable (id_orden). Une `lead_history` con las tareas vinculadas
   * al lead como actividades, sin duplicar el módulo de tareas.
   *
   * `id_orden` es texto de ancho fijo para que la comparación lexicográfica del
   * cursor coincida con el orden numérico real.
   */
  async findEvents({ leadId, eventType, desde, hasta, limit = 25, cursor }) {
    const params = [];
    const next = () => `$${params.push(null)}`;

    params.push(leadId);
    const pLead = '$1';

    let whereHistorial = `h.lead_id = ${pLead}`;
    if (eventType) {
      const p = next();
      params[params.length - 1] = eventType;
      whereHistorial += ` AND h.event_type = ${p}`;
    }
    if (desde) {
      const p = next();
      params[params.length - 1] = desde;
      whereHistorial += ` AND h.created_at >= ${p}`;
    }
    if (hasta) {
      const p = next();
      params[params.length - 1] = hasta;
      whereHistorial += ` AND h.created_at <= ${p}`;
    }

    // La rama de gestiones solo entra cuando el filtro no excluye las actividades.
    const incluirGestiones = !eventType || eventType === 'ACTIVIDAD';

    const ramas = [`
        SELECT
          LPAD(h.id::text, 15, '0')  AS id_orden,
          h.created_at               AS fecha,
          'HISTORIAL'                AS fuente,
          h.id::text                 AS id_evento,
          h.event_type               AS tipo,
          h.field_name               AS campo,
          h.old_value                AS valor_anterior,
          h.new_value                AS valor_nuevo,
          h.description              AS descripcion,
          h.performed_by_name        AS usuario,
          h.assigned_employee_name   AS empleado,
          h.metadata                 AS metadata,
          h.nota                     AS nota,
          -- Duración en el estado: solo para eventos que ENTRAN a un estado.
          -- Las modificaciones intermedias no cambian el estado y no la cortan.
          CASE WHEN en.id IS NULL THEN NULL
               ELSE EXTRACT(EPOCH FROM (COALESCE(en.siguiente, now()) - h.created_at))::bigint
          END                        AS duracion_segundos,
          -- El backfill no reconstruye la historia: su duración no es confiable.
          CASE WHEN en.id IS NULL THEN NULL
               WHEN h.metadata->>'origen' = 'migracion' THEN false
               ELSE true
          END                        AS duracion_confiable,
          CASE WHEN en.id IS NOT NULL AND en.siguiente IS NULL THEN true ELSE false END
                                     AS es_estado_actual
        FROM lead_history h
        LEFT JOIN entradas en ON en.id = h.id
        WHERE ${whereHistorial}`];

    if (incluirGestiones) {
      // Las gestiones comerciales viven en su propia tabla (migración 141) y
      // entran a la línea de tiempo por fecha OCURRENCIA, no por fecha de
      // registro. Antes se leía de `tasks`, que no guarda el resultado ni el
      // empleado real ni el momento en que pasó la gestión.
      ramas.push(`
        SELECT
          'G-' || g.id               AS id_orden,
          g.fecha_gestion            AS fecha,
          'ACTIVIDAD'                AS fuente,
          g.id::text                 AS id_evento,
          'ACTIVIDAD'                AS tipo,
          g.tipo                     AS campo,
          NULL::text                 AS valor_anterior,
          g.resultado                AS valor_nuevo,
          (CASE g.tipo
             WHEN 'llamada'      THEN 'Llamada'
             WHEN 'reunion'      THEN 'Reunión'
             WHEN 'correo'       THEN 'Correo de seguimiento'
             WHEN 'observacion'  THEN 'Observación'
             ELSE 'Otra gestión'
           END
           || COALESCE(': ' || g.observaciones, '')) AS descripcion,
          g.created_by_name          AS usuario,
          g.employee_name            AS empleado,
          jsonb_strip_nulls(jsonb_build_object(
            'gestion_tipo',         g.tipo,
            'gestion_resultado',    g.resultado,
            'proxima_seguimiento',  g.proxima_seguimiento
          ))                         AS metadata,
          NULL::text                 AS nota,
          NULL::bigint               AS duracion_segundos,
          NULL::boolean              AS duracion_confiable,
          NULL::boolean              AS es_estado_actual
        FROM lead_gestiones g
        WHERE g.lead_id = ${pLead}`);
    }

    let whereCursor = '';
    if (cursor?.fecha && cursor?.orden) {
      const pFecha = next();
      params[params.length - 1] = cursor.fecha;
      const pOrden = next();
      params[params.length - 1] = cursor.orden;
      whereCursor = `WHERE (fecha < ${pFecha} OR (fecha = ${pFecha} AND id_orden < ${pOrden}))`;
    }

    const pLimit = next();
    params[params.length - 1] = limit + 1;

    const sql = `
      WITH entradas AS (
        -- Entradas a un estado: creación y cambios de estado. La duración se
        -- calcula SIEMPRE aquí, sin los filtros de la consulta, para que un
        -- filtro por tipo o por fecha no altere las duraciones mostradas.
        SELECT id, created_at,
               LEAD(created_at) OVER (ORDER BY created_at, id) AS siguiente
          FROM lead_history
         WHERE lead_id = ${pLead}
           AND event_type IN ('CREACION', 'CAMBIO_ESTADO')
      ),
      eventos AS (${ramas.join('\n        UNION ALL\n')})
      SELECT * FROM eventos
      ${whereCursor}
      ORDER BY fecha DESC, id_orden DESC
      LIMIT ${pLimit}`;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const ultimo = rows[rows.length - 1];
    const nextCursor = hasMore && ultimo
      ? { fecha: ultimo.fecha, orden: ultimo.id_orden }
      : null;

    return { data: rows.map(mapearEvento), pagination: { hasMore, nextCursor } };
  }

  /**
   * Anota en el evento de asignación el resultado del correo.
   * Se ejecuta DESPUÉS del commit (la regla de Fase 2 es que el correo no se pide
   * dentro de la transacción), por eso es una actualización aparte y no una
   * excepción a la atomicidad de la modificación del lead.
   */
  async registrarResultadoNotificacion(eventoId, resultado) {
    if (!eventoId) return;

    await query(
      `UPDATE lead_history
       SET metadata = COALESCE(metadata, '{}'::jsonb)
                     || jsonb_build_object(
                          'notificacion_enviada', $2::boolean,
                          'notificacion_motivo',  $3,
                          'notificacion_fecha',   now()
                        )
       WHERE id = $1`,
      [eventoId, resultado?.enviado === true, resultado?.motivo || null]
    ).catch(() => {
      // El historial ya quedó escrito y el lead ya existe: nunca se propaga un
      // fallo de anotación del resultado del correo.
    });
  }

  /**
   * Resumen del ciclo de vida del lead (indicadores de cabecera).
   *
   * Todo se calcula de fuentes reales: la tabla `leads` y `lead_history`.
   *
   * OJO con `ultima_gestion`: NO es "última modificación del lead". Un cambio de
   * estado, una reasignación o un correo son operaciones administrativas, no
   * gestión comercial. Aquí solo cuenta una gestión comercial REAL registrada en
   * `lead_gestiones` (llamada, reunión, correo de seguimiento, observación),
   * por su fecha de OCURRENCIA y no por la de registro.
   *
   * Hoy `lead_gestiones` está vacía, así que este indicador devuelve NULL y la
   * interfaz muestra "Sin gestión registrada". Es el dato honesto, no uno
   * reconstruido. Empezará a llenarse en cuanto se registren gestiones desde el
   * detalle del lead.
   */
  async findSummary(leadId) {
    const sql = `
      SELECT
        l.created_at      AS fecha_creacion,
        l.status          AS estado_actual,
        l.updated_at      AS ultima_modificacion,
        l.deleted_at      AS archivado_en,
        e.full_name       AS responsable_actual,
        (SELECT MIN(h.created_at) FROM lead_history h
          WHERE h.lead_id = l.id AND h.event_type = 'ASIGNACION')
                          AS fecha_primera_asignacion,
        -- Solo gestión comercial REAL, por su fecha de ocurrencia.
        -- lead_gestiones es la única fuente: las modificaciones del lead no
        -- cuentan.
        (SELECT MAX(g.fecha_gestion) FROM lead_gestiones g
          WHERE g.lead_id = l.id)
                          AS ultima_gestion,
        (SELECT COUNT(*) FROM lead_gestiones g WHERE g.lead_id = l.id)::int
                          AS total_gestiones,
        -- Eventos de auditoría + gestiones: la actividad total del lead
        ((SELECT COUNT(*) FROM lead_history h WHERE h.lead_id = l.id)
       + (SELECT COUNT(*) FROM lead_gestiones g WHERE g.lead_id = l.id))::int
                          AS total_eventos
      FROM leads l
      LEFT JOIN employees e ON e.id = l.assigned_employee_id
      WHERE l.id = $1`;

    const result = await query(sql, [leadId]);
    return result.rows[0] || null;
  }
}

function mapearEvento(row) {
  return {
    id: row.id_evento,
    fecha: row.fecha,
    fuente: row.fuente,
    tipo: row.tipo,
    campo: row.campo,
    etiquetaCampo: row.campo ? (ETIQUETAS_CAMPO[row.campo] || row.campo) : null,
    valorAnterior: row.valor_anterior,
    valorNuevo: row.valor_nuevo,
    descripcion: row.descripcion,
    usuario: row.usuario,
    empleado: row.empleado,
    metadata: row.metadata || null,
    // Nota escrita por el usuario (solo CAMBIO_ESTADO manuales).
    nota: row.nota ?? null,
    // Duración en el estado. NULL en gestiones y modificaciones.
    duracionSegundos: row.duracion_segundos === null || row.duracion_segundos === undefined
      ? null
      : Number(row.duracion_segundos),
    duracionConfiable: row.duracion_confiable ?? null,
    esEstadoActual: row.es_estado_actual === true,
  };
}
