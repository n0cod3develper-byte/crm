import { query, withTransaction } from '../../config/database.js';
import { ValidationError } from '../../utils/errors.js';
import { NOTA_MIN, NOTA_MAX } from './leads.constants.js';
import {
  LeadsHistoryRepository,
  diffLead,
  ESTADOS_CIERRE,
  ETIQUETAS_CAMPO,
} from './leadsHistory.repository.js';

const historyRepo = new LeadsHistoryRepository();

/**
 * Valida la nota de un cambio de estado.
 * La nota SOLO es obligatoria cuando el estado cambia de verdad: editar otros
 * campos (o reenviar el mismo estado) no exige nota.
 * Es la fuente de verdad del dominio: protege también llamadas internas.
 */
export function validarNotaCambioEstado(nota, estadoAnterior, estadoNuevo) {
  if (!estadoNuevo || estadoAnterior === estadoNuevo) return;

  const limpia = typeof nota === 'string' ? nota.trim() : '';

  if (limpia.length < NOTA_MIN) {
    throw new ValidationError([{
      field: 'nota',
      message: `La nota del cambio de estado es obligatoria (mínimo ${NOTA_MIN} caracteres)`,
    }]);
  }
  if (limpia.length > NOTA_MAX) {
    throw new ValidationError([{
      field: 'nota',
      message: `La nota del cambio de estado no puede superar ${NOTA_MAX} caracteres`,
    }]);
  }
}

/** Ejecuta una consulta usando el cliente de transacción cuando se pasa, o el pool. */
const ejecutar = (client, sql, params) => (client ? client.query(sql, params) : query(sql, params));

export class LeadsRepository {
  /**
   * @param {Object} opts.archivados  `true` → lista SOLO los archivados
   *  (vista de archivados). Por defecto lista los activos y excluye los
   *  archivados.
   */
  async findAll({ status, assignedTo, source, campaignId, search, limit = 50, cursor, archivados = false }) {
    // Vista de archivados: en vez de excluirlos, los selecciona.
    const conditions = archivados
      ? ['1=1', 'l.deleted_at IS NOT NULL']
      : ['1=1', 'l.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (status && status !== 'undefined') {
      conditions.push(`l.status = $${i++}`);
      params.push(status);
    }
    // `assignedTo` mantiene su nombre por compatibilidad, pero ahora filtra por EMPLEADO.
    // 'none' es el valor especial del frontend para "Sin asignar".
    if (assignedTo && assignedTo !== 'undefined') {
      if (assignedTo === 'none') {
        conditions.push(`l.assigned_employee_id IS NULL`);
      } else {
        conditions.push(`l.assigned_employee_id = $${i++}`);
        params.push(assignedTo);
      }
    }
    if (source && source !== 'undefined') {
      conditions.push(`l.source = $${i++}`);
      params.push(source);
    }
    if (campaignId && campaignId !== 'undefined') {
      conditions.push(`l.campaign_id = $${i++}`);
      params.push(campaignId);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(l.first_name ILIKE $${i} OR l.last_name ILIKE $${i} OR l.email ILIKE $${i} OR l.company_name ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      // En la vista de archivados se pagina por la fecha de archivado, que es
      // el orden que esa vista usa.
      const columnaFecha = archivados ? 'l.deleted_at' : 'l.created_at';
      conditions.push(`${columnaFecha} < (SELECT ${archivados ? 'deleted_at' : 'created_at'} FROM leads WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT l.*,
        e.full_name AS assigned_employee_name,
        c.name AS campaign_name
      FROM leads l
      LEFT JOIN employees e ON e.id = l.assigned_employee_id
      LEFT JOIN campaigns c ON c.id = l.campaign_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${archivados ? 'l.deleted_at DESC' : 'l.created_at DESC'}
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null },
    };
  }

  /**
   * Busca un lead ACTIVO. Es el que usan las rutas de escritura: un lead archivado
   * responde 404 para editar, convertir o archivar de nuevo.
   */
  async findById(id, client = null) {
    const result = await ejecutar(client,
      `SELECT l.*, e.full_name AS assigned_employee_name, c.name AS campaign_name
       FROM leads l
       LEFT JOIN employees e ON e.id = l.assigned_employee_id
       LEFT JOIN campaigns c ON c.id = l.campaign_id
       WHERE l.id = $1 AND l.deleted_at IS NULL`, [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Igual que `findById`, pero bloquea la fila hasta el final de la transacción
   * (`FOR UPDATE OF l`).
   *
   * Se usa en TODA escritura que pueda cambiar el estado: dos cambios
   * simultáneos se serializan y la cadena anterior → nuevo queda coherente.
   * `FOR UPDATE OF l` evita bloquear los lados opcionales de los LEFT JOIN.
   */
  async lockById(id, client) {
    const result = await client.query(
      `SELECT l.*, e.full_name AS assigned_employee_name, c.name AS campaign_name
         FROM leads l
         LEFT JOIN employees e ON e.id = l.assigned_employee_id
         LEFT JOIN campaigns c ON c.id = l.campaign_id
        WHERE l.id = $1 AND l.deleted_at IS NULL
        FOR UPDATE OF l`, [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca un lead TENIENDO EN CUENTA los archivados.
   *
   * Lo usan SOLO las rutas de lectura (detalle, historial y resumen): archivar un
   * lead lo retira del listado pero NO destruye su información ni su trazabilidad,
   * y el historial debe seguir siendo consultable.
   */
  async findByIdIncluyendoArchivado(id, client = null) {
    const result = await ejecutar(client,
      `SELECT l.*, e.full_name AS assigned_employee_name, c.name AS campaign_name
       FROM leads l
       LEFT JOIN employees e ON e.id = l.assigned_employee_id
       LEFT JOIN campaigns c ON c.id = l.campaign_id
       WHERE l.id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Empleados activos para el desplegable "Asignado a".
   * Devuelve SOLO id y nombre: jamás salario, EPS, ARL ni documento.
   */
  async findAsignables(search) {
    const params = [];
    let where = `WHERE e.status = 'Activo'`;
    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      where += ` AND e.full_name ILIKE $1`;
    }
    const result = await query(
      `SELECT e.id, e.full_name
       FROM employees e
       ${where}
       ORDER BY e.full_name ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Verifica que el empleado exista y esté activo. Devuelve el empleado o lanza un error.
   * Se usa antes de persistir una asignación: impide asignar a inactivos o inexistentes.
   */
  async findEmpleadoAsignable(id) {
    const result = await query(
      `SELECT id, full_name, email, status FROM employees WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /** Historial de envíos de notificación de asignación (auditoría). */
  async registrarNotificacion({ leadId, empleadoId, asignadoPor, dedupKey, recipients }) {
    const result = await query(
      `INSERT INTO lead_asignacion_notificaciones
         (lead_id, empleado_id, asignado_por, dedup_key, recipients)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (dedup_key) DO NOTHING
       RETURNING id`,
      [leadId, empleadoId, asignadoPor || null, dedupKey, recipients]
    );
    return result.rows[0] || null;
  }

  async marcarNotificacionEnviada(id) {
    await query(
      `UPDATE lead_asignacion_notificaciones
       SET status = 'enviado', sent_at = NOW(), attempts = attempts + 1
       WHERE id = $1`,
      [id]
    );
  }

  async marcarNotificacionError(id, mensaje) {
    await query(
      `UPDATE lead_asignacion_notificaciones
       SET status = 'error', last_error = $2, attempts = attempts + 1
       WHERE id = $1`,
      [id, (mensaje || 'Error desconocido').slice(0, 2000)]
    );
  }

  async create(data, client = null) {
    const { first_name, last_name, email, phone, company_name, source, campaign_id, status, score, assigned_employee_id, notes } = data;
    const result = await ejecutar(client,
      `INSERT INTO leads
        (first_name, last_name, email, phone, company_name, source, campaign_id, status, score, assigned_employee_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [first_name, last_name || null, email || null, phone || null, company_name || null,
       source || null, campaign_id || null, status || 'new', score || 0, assigned_employee_id || null, notes || null]
    );
    return result.rows[0];
  }

  async update(id, data, client = null) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['first_name', 'last_name', 'email', 'phone', 'company_name', 'source', 'campaign_id', 'status', 'score', 'assigned_employee_id', 'notes'];
    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key] === '' ? null : data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id, client);
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await ejecutar(client,
      `UPDATE leads SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async convertToContact(id, ctx = {}) {
    // Todo el proceso (empresa -> contacto -> estado del lead) y su trazabilidad
    // se ejecutan en UNA transacción: si algo falla, no queda un contacto a medias.
    return withTransaction(async (client) => {
      const lead = await this.lockById(id, client);
      if (!lead || lead.status === 'converted') return null;

      // La conversión es un cambio de estado manual: exige nota (D1).
      validarNotaCambioEstado(ctx.nota, lead.status, 'converted');

      let companyId = null;

      // 1. Si el lead tiene empresa, crear o buscar la empresa
      if (lead.company_name) {
        const existingCompany = await client.query(`SELECT id FROM companies WHERE name ILIKE $1 LIMIT 1`, [lead.company_name]);
        if (existingCompany.rows.length > 0) {
          companyId = existingCompany.rows[0].id;
        } else {
          const newCompany = await client.query(
            `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
            [lead.company_name]
          );
          companyId = newCompany.rows[0].id;
        }
      }

      // 2. Crear el contacto
      const newContact = await client.query(
        `INSERT INTO contacts (first_name, last_name, email, phone, company_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [lead.first_name, lead.last_name, lead.email, lead.phone, companyId]
      );
      const contactId = newContact.rows[0].id;

      // 3. Actualizar el Lead a 'converted'
      const updatedLead = await client.query(
        `UPDATE leads SET status = 'converted', converted_contact_id = $1, converted_at = NOW() WHERE id = $2 RETURNING *`,
        [contactId, id]
      );

      // 4. Trazabilidad: cambio de estado + cierre comercial
      //    Pasa por el ÚNICO escritor de CAMBIO_ESTADO del módulo.
      await this._registrarCambioEstado(client, {
        leadId: id,
        estadoAnterior: lead.status,
        estadoNuevo: 'converted',
        nota: ctx.nota,
        ctx,
        descripcionCambio: `Estado cambiado de "${lead.status}" a "converted" (conversión a contacto)`,
        cierreDescripcion: `Lead convertido en contacto #${contactId}`,
        cierreMetadata: { contacto_id: contactId, empresa_id: companyId },
      });

      return { lead: updatedLead.rows[0], contact: newContact.rows[0] };
    });
  }

  /**
   * Crea el lead y su evento de creación en LA MISMA transacción.
   * Si el registro de auditoría falla, no se crea el lead.
   *
   * @param {Object} data
   * @param {Object} ctx  { userId, userName, empleado?: { id, nombre } }
   */
  async createConHistorial(data, ctx = {}) {
    return withTransaction(async (client) => {
      const lead = await this.create(data, client);

      const base = {
        leadId: lead.id,
        performedByUserId: ctx.userId || null,
        performedByName: ctx.userName || null,
      };

      // El nombre del empleado se resuelve AQUÍ, no se depende del llamador:
      // así el historial queda completo aunque el repositorio se use sin controlador.
      const nombreEmpleado = lead.assigned_employee_id
        ? (await this.nombreDeEmpleado(client, lead.assigned_employee_id)) || ctx.empleado?.nombre || null
        : null;

      const eventoCreacionId = await historyRepo.registrar({
        ...base,
        eventType: 'CREACION',
        newValue: lead.status,
        description: `Lead creado. Estado inicial: "${lead.status}".`,
        assignedEmployeeId: lead.assigned_employee_id || null,
        assignedEmployeeName: nombreEmpleado,
      }, client);

      let eventoAsignacionId = null;
      if (lead.assigned_employee_id) {
        eventoAsignacionId = await historyRepo.registrar({
          ...base,
          eventType: 'ASIGNACION',
          fieldName: 'assigned_employee_id',
          oldValue: null,
          newValue: nombreEmpleado,
          description: `Asignado a "${nombreEmpleado || 'empleado'}" al crear el lead`,
          assignedEmployeeId: lead.assigned_employee_id,
          assignedEmployeeName: nombreEmpleado,
        }, client);
      }

      return { lead, eventoCreacionId, eventoAsignacionId };
    });
  }

  /** Nombre completo del empleado, dentro de la transacción recibida. */
  async nombreDeEmpleado(client, empleadoId) {
    const r = await ejecutar(client, `SELECT full_name FROM employees WHERE id = $1`, [empleadoId]);
    return r.rows[0]?.full_name || null;
  }

  /**
   * ÚNICO punto que inserta eventos CAMBIO_ESTADO (y su CIERRE derivado).
   *
   * Debe llamarse SIEMPRE dentro de una transacción y con la fila del lead ya
   * bloqueada con `lockById`. La nota solo se guarda en CAMBIO_ESTADO; el
   * CIERRE es un evento derivado y no la duplica.
   *
   * @param {Object} p
   * @param {string} p.leadId
   * @param {string} p.estadoAnterior
   * @param {string} p.estadoNuevo
   * @param {string} [p.nota]
   * @param {Object} p.ctx  { userId, userName }
   * @param {string} [p.descripcionCambio]
   * @param {string} [p.cierreDescripcion]
   * @param {Object} [p.cierreMetadata]
   */
  async _registrarCambioEstado(client, {
    leadId,
    estadoAnterior,
    estadoNuevo,
    nota,
    ctx = {},
    descripcionCambio,
    cierreDescripcion,
    cierreMetadata,
  }) {
    if (!estadoNuevo || estadoAnterior === estadoNuevo) return null;

    const base = {
      leadId,
      performedByUserId: ctx.userId || null,
      performedByName: ctx.userName || null,
    };

    const eventoId = await historyRepo.registrar({
      ...base,
      eventType: 'CAMBIO_ESTADO',
      fieldName: 'status',
      oldValue: estadoAnterior,
      newValue: estadoNuevo,
      nota,
      description: descripcionCambio
        || `Estado cambiado de "${estadoAnterior}" a "${estadoNuevo}"`,
    }, client);

    if (ESTADOS_CIERRE.includes(estadoNuevo) && !ESTADOS_CIERRE.includes(estadoAnterior)) {
      await historyRepo.registrar({
        ...base,
        eventType: 'CIERRE',
        fieldName: 'status',
        oldValue: estadoAnterior,
        newValue: estadoNuevo,
        description: cierreDescripcion || `Lead cerrado en estado "${estadoNuevo}"`,
        metadata: cierreMetadata || null,
      }, client);
    }

    return eventoId;
  }

  /**
   * Actualiza el lead y registra CADA cambio real en la misma transacción.
   * Si la escritura de auditoría falla, se revierte la modificación completa.
   *
   * @param {string} id
   * @param {Object} data
   * @param {Object} ctx  { userId, userName, empleado?: { id, nombre } }
   */
  async updateConHistorial(id, data, ctx = {}) {
    return withTransaction(async (client) => {
      // Bloquea la fila: dos cambios simultáneos se serializan.
      const actual = await this.lockById(id, client);
      if (!actual) return null;

      // La nota es obligatoria SOLO si el estado cambia de verdad (D1).
      validarNotaCambioEstado(data.nota, actual.status, data.status);

      const lead = await this.update(id, data, client);
      if (!lead) return null;

      const base = {
        leadId: id,
        performedByUserId: ctx.userId || null,
        performedByName: ctx.userName || null,
      };

      const cambios = diffLead(actual, lead);
      const esCambioDeEstado = actual.status !== lead.status;
      const esCambioDeAsignacion = (actual.assigned_employee_id || null) !== (lead.assigned_employee_id || null);

      // 1. Modificaciones campo a campo (el estado y la asignación van aparte)
      for (const c of cambios) {
        if (c.fieldName === 'status') continue;
        await historyRepo.registrar({
          ...base,
          eventType: 'MODIFICACION',
          fieldName: c.fieldName,
          oldValue: c.oldValue,
          newValue: c.newValue,
          description: `${ETIQUETAS_CAMPO[c.fieldName] || c.fieldName} modificado`,
        }, client);
      }

      // 2. Cambio de estado + cierre (único escritor: _registrarCambioEstado)
      if (esCambioDeEstado) {
        await this._registrarCambioEstado(client, {
          leadId: id,
          estadoAnterior: actual.status,
          estadoNuevo: lead.status,
          nota: data.nota,
          ctx,
        });
      }

      // 3. Asignación (conserva el historial completo de reasignaciones)
      let eventoAsignacionId = null;
      if (esCambioDeAsignacion) {
        const anterior = actual.assigned_employee_name || null;
        const nuevo = lead.assigned_employee_id
          ? (await this.nombreDeEmpleado(client, lead.assigned_employee_id)) || ctx.empleado?.nombre || null
          : null;

        eventoAsignacionId = await historyRepo.registrar({
          ...base,
          eventType: 'ASIGNACION',
          fieldName: 'assigned_employee_id',
          oldValue: anterior,
          newValue: nuevo,
          description: !lead.assigned_employee_id
            ? `Asignación retirada (estaba con "${anterior || 'sin asignar'}")`
            : anterior
              ? `Reasignado de "${anterior}" a "${nuevo}"`
              : `Asignado a "${nuevo}"`,
          assignedEmployeeId: lead.assigned_employee_id || null,
          assignedEmployeeName: nuevo,
        }, client);
      }

      return { lead, cambios, eventoAsignacionId };
    });
  }

  /**
   * Archiva el lead (borrado lógico) y registra el evento en LA MISMA transacción.
   *
   * No se borra nada: se conservan la información y la trazabilidad completas.
   * Si el registro de auditoría falla, se revierte el archivado.
   *
   * @param {string} id
   * @param {Object} ctx { userId, userName }
   */
  async delete(id, ctx = {}) {
    return withTransaction(async (client) => {
      const lead = await this.findById(id, client);
      if (!lead) return null;

      const r = await ejecutar(client,
        `UPDATE leads
            SET deleted_at = NOW(), deleted_by = $2,
                deleted_by_name = $3, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id, deleted_at`,
        [id, ctx.userId || null, ctx.userName || null]
      );
      const archivado = r.rows[0];
      if (!archivado) return null;

      await historyRepo.registrar({
        leadId: id,
        eventType: 'MODIFICACION',
        fieldName: 'deleted_at',
        oldValue: null,
        newValue: archivado.deleted_at instanceof Date
          ? archivado.deleted_at.toISOString()
          : String(archivado.deleted_at),
        description: 'Lead archivado (borrado lógico). Se conserva su información y trazabilidad.',
        performedByUserId: ctx.userId || null,
        performedByName: ctx.userName || null,
      }, client);

      return archivado;
    });
  }

  /**
   * Restaura un lead archivado (invierte el borrado lógico).
   *
   * GARANTÍAS:
   * · Transaccional: si falla el registro RESTAURACION en `lead_history`, se
   *   revierte el restore. Nunca queda un lead restaurado sin trazabilidad.
   * · NO envía correo de asignación. El correo solo lo dispara el controlador
   *   cuando cambia `assigned_employee_id` vía PATCH; este método es un
   *   UPDATE dedicado que no pasa por esa ruta, y además NO toca
   *   `assigned_employee_id` ni `status`.
   * · Conserva responsable y estado: el archivado solo puso `deleted_at` y
   *   `deleted_by`, así que se limpian esas tres columnas y nada más. Se
   *   captura el estado antes y después para dejar constancia en el evento.
   * · El historial completo se conserva sin tocar (las gestiones y los eventos
   *   viven en sus propias tablas y no se borran al archivar).
   *
   * @param {string} id
   * @param {Object} ctx { userId, userName }
   */
  async restaurar(id, ctx = {}) {
    return withTransaction(async (client) => {
      // findByIncluyendoArchivado: el activo no tiene nada que restaurar
      const lead = await this.findByIdIncluyendoArchivado(id, client);
      if (!lead || !lead.deleted_at) return null;

      const r = await ejecutar(client,
        `UPDATE leads
            SET deleted_at = NULL, deleted_by = NULL, deleted_by_name = NULL,
                updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NOT NULL
          RETURNING *`,
        [id]
      );
      const restaurado = r.rows[0];
      if (!restaurado) return null;

      // Estado conservado: responsable y estado NO se tocaron al archivar.
      // En `metadata` se usa snake_case, igual que en `contacto_id` al convertir.
      const estadoConservado = {
        estado_anterior: lead.status,
        estado_actual: restaurado.status,
        empleado_anterior: lead.assigned_employee_name,
        empleado_actual: restaurado.assigned_employee_id === lead.assigned_employee_id
          ? lead.assigned_employee_name
          : null,
        archivado_en: lead.deleted_at,
      };

      await historyRepo.registrar({
        leadId: id,
        eventType: 'RESTAURACION',
        fieldName: 'deleted_at',
        // Valor anterior: cuándo se había archivado. Nuevo: vacío (activo).
        oldValue: lead.deleted_at instanceof Date
          ? lead.deleted_at.toISOString()
          : String(lead.deleted_at),
        newValue: null,
        description: `Lead restaurado. Conserva su estado (${estadoConservado.estado_actual}) y su responsable.`,
        performedByUserId: ctx.userId || null,
        performedByName: ctx.userName || null,
        assignedEmployeeId: restaurado.assigned_employee_id || null,
        assignedEmployeeName: estadoConservado.empleado_actual,
        metadata: estadoConservado,
      }, client);

      return { ...restaurado, estadoConservado };
    });
  }
}
