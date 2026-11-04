import { query, withTransaction } from '../../config/database.js';

/**
 * Catálogo de tipos de gestión comercial.
 * Se alinea con el CHECK de `type` de la tabla `tasks` para que el lenguaje sea
 * el mismo en todo el CRM (call / meeting / email / follow_up).
 */
export const TIPOS_GESTION = ['llamada', 'reunion', 'correo', 'observacion', 'otro'];

/** Etiquetas visibles (español Colombia). */
export const ETIQUETAS_TIPO_GESTION = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo de seguimiento',
  observacion: 'Observación',
  otro: 'Otra gestión',
};

const MAPEAR_TIPO = {
  llamada: 'phone-call',
  reunion: 'users',
  correo: 'mail',
  observacion: 'message-square',
  otro: 'clipboard',
};

/**
 * Registro de gestión comercial de un lead.
 *
 * Es un HECHO HISTÓRICO cerrado, no una tarea pendiente. Por eso vive en su
 * propia tabla y no en `tasks` (ver el porqué en la migración 141).
 *
 * El nombre del empleado va denormalizado para conservar la auditoría aunque
 * el empleado se desactive, igual que en `lead_history`.
 */
export class LeadGestionesRepository {

  /**
   * Crea una gestión. Sin transacción propia: es un INSERT simple.
   * El caller puede pasar un cliente para participar de su transacción.
   */
  async create(leadId, data, ctx = {}, client = null) {
    const sql = `
      INSERT INTO lead_gestiones
        (lead_id, tipo, observaciones, resultado, fecha_gestion,
         proxima_seguimiento, employee_id, employee_name, created_by, created_by_name)
      VALUES ($1,$2,$3,$4,COALESCE($5,NOW()),$6,$7,$8,$9,$10)
      RETURNING *`;

    const params = [
      leadId,
      data.tipo,
      data.observaciones || null,
      data.resultado || null,
      data.fecha_gestion || null,
      data.proxima_seguimiento || null,
      data.employee_id || null,
      data.employee_name || null,
      ctx.userId || null,
      ctx.userName || null,
    ];

    const r = client ? await client.query(sql, params) : await query(sql, params);
    return mapear(r.rows[0]);
  }

  /**
   * Lista las gestiones de un lead, más recientes primero.
   *
   * @param {string} leadId
   * @param {Object} opts { limit, cursor:{fecha,id}, tipo, desde, hasta }
   * @param {Object} client  cliente de transacción opcional
   */
  async findByLead(leadId, { limit = 20, cursor, tipo, desde, hasta } = {}, client = null) {
    const condiciones = ['g.lead_id = $1'];
    const params = [leadId];
    let i = 2;

    if (tipo) {
      condiciones.push(`g.tipo = $${i++}`);
      params.push(tipo);
    }
    if (desde) {
      condiciones.push(`g.fecha_gestion >= $${i++}`);
      params.push(desde);
    }
    if (hasta) {
      condiciones.push(`g.fecha_gestion <= $${i++}`);
      params.push(hasta);
    }
    if (cursor?.fecha && cursor?.id) {
      condiciones.push(`(g.fecha_gestion, g.id) < ($${i++}, $${i++})`);
      params.push(cursor.fecha, cursor.id);
    }

    const nLimite = i;
    params.push(limit + 1);

    const r = (client ? await client.query(sqlConLimit(condiciones, params, nLimite), params)
                      : await query(sqlConLimit(condiciones, params, nLimite), params));

    const filas = r.rows.slice(0, limit);
    const hayMas = r.rows.length > limit;
    const ultima = filas[filas.length - 1];

    return {
      data: filas.map(mapear),
      pagination: {
        hasMore: hayMas,
        nextCursor: hayMas && ultima
          ? { fecha: ultima.fecha_gestion, id: ultima.id }
          : null,
      },
    };
  }

  /**
   * Fecha de la ÚLTIMA gestión comercial real.
   *
   * Sale de `lead_gestiones`, nunca de modificaciones del lead: un cambio de
   * estado o una reasignación no son gestión comercial.
   */
  async ultimaGestion(leadId, client = null) {
    const sql = `
      SELECT fecha_gestion, tipo, resultado
        FROM lead_gestiones
       WHERE lead_id = $1
       ORDER BY fecha_gestion DESC, id DESC
       LIMIT 1`;
    const r = client ? await client.query(sql, [leadId]) : await query(sql, [leadId]);
    return r.rows[0] || null;
  }

  /**
   * Total de gestiones del lead (para el resumen del ciclo de vida).
   */
  async contar(leadId, client = null) {
    const sql = `SELECT COUNT(*)::int AS n FROM lead_gestiones WHERE lead_id = $1`;
    const r = client ? await client.query(sql, [leadId]) : await query(sql, [leadId]);
    return r.rows[0].n;
  }

  /** Próximos seguimientos pendientes de un lead. */
  async proximosSeguimientos(leadId, client = null) {
    const sql = `
      SELECT * FROM lead_gestiones
       WHERE lead_id = $1 AND proxima_seguimiento IS NOT NULL
         AND proxima_seguimiento > NOW()
       ORDER BY proxima_seguimiento ASC`;
    const r = client ? await client.query(sql, [leadId]) : await query(sql, [leadId]);
    return r.rows.map(mapear);
  }
}

function sqlConLimit(condiciones, params, nLimite) {
  return `
    SELECT g.* FROM lead_gestiones g
     WHERE ${condiciones.join(' AND ')}
     ORDER BY g.fecha_gestion DESC, g.id DESC
     LIMIT $${nLimite}`;
}

/** Fila cruda → forma que consume el frontend. */
function mapear(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    tipo: row.tipo,
    etiquetaTipo: ETIQUETAS_TIPO_GESTION[row.tipo] || row.tipo,
    iconoTipo: MAPEAR_TIPO[row.tipo] || 'clipboard',
    observaciones: row.observaciones,
    resultado: row.resultado,
    fechaGestion: row.fecha_gestion,
    proximaSeguimiento: row.proxima_seguimiento,
    employeeId: row.employee_id,
    empleado: row.employee_name,
    creadoPor: row.created_by_name,
    creadoEn: row.created_at,
  };
}
