import { query } from '../../config/database.js';

/**
 * Repositorio de Email Marketing
 * Usa SQL nativo con pg (mismo patrón que el resto del CRM)
 */
export class EmailMarketingRepository {

  // ════════════════════════════════════════════════════════════
  // LISTAS
  // ════════════════════════════════════════════════════════════

  async getListas({ search = '', limit = 50, offset = 0 } = {}) {
    const params = [];
    let where = 'l.deleted_at IS NULL';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (l.nombre ILIKE $${params.length} OR l.descripcion ILIKE $${params.length})`;
    }
    params.push(limit, offset);

    const sql = `
      SELECT
        l.*,
        COUNT(lc.contacto_id) FILTER (
          WHERE ec.estado = 'activo' AND ec.deleted_at IS NULL
        ) AS total_contactos_activos,
        COUNT(lc.contacto_id) AS total_contactos
      FROM email_listas l
      LEFT JOIN email_lista_contactos lc ON lc.lista_id = l.id
      LEFT JOIN email_contactos ec ON ec.id = lc.contacto_id
      WHERE ${where}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const countSql = `SELECT COUNT(*) FROM email_listas WHERE deleted_at IS NULL
      ${search ? `AND (nombre ILIKE $1 OR descripcion ILIKE $1)` : ''}`;
    const countParams = search ? [`%${search}%`] : [];

    const [rows, count] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    return { data: rows.rows, total: parseInt(count.rows[0].count) };
  }

  async getListaById(id) {
    const result = await query(
      `SELECT l.*, COUNT(lc.contacto_id) FILTER (WHERE ec.estado = 'activo' AND ec.deleted_at IS NULL) AS total_contactos_activos
       FROM email_listas l
       LEFT JOIN email_lista_contactos lc ON lc.lista_id = l.id
       LEFT JOIN email_contactos ec ON ec.id = lc.contacto_id
       WHERE l.id = $1 AND l.deleted_at IS NULL
       GROUP BY l.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async createLista(data) {
    const { nombre, descripcion, criterio_segmentacion } = data;
    const result = await query(
      `INSERT INTO email_listas (nombre, descripcion, criterio_segmentacion)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre, descripcion || null, criterio_segmentacion ? JSON.stringify(criterio_segmentacion) : '{}']
    );
    return result.rows[0];
  }

  async updateLista(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['nombre', 'descripcion', 'criterio_segmentacion'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(key === 'criterio_segmentacion' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    if (fields.length === 0) return this.getListaById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE email_listas SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteLista(id) {
    const result = await query(
      `UPDATE email_listas SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getContactosDeLista(listaId) {
    const result = await query(
      `SELECT ec.*, comp.name AS empresa_nombre
       FROM email_lista_contactos lc
       JOIN email_contactos ec ON ec.id = lc.contacto_id
       LEFT JOIN companies comp ON comp.id = ec.empresa_id
       WHERE lc.lista_id = $1 AND ec.deleted_at IS NULL
       ORDER BY ec.nombre ASC`,
      [listaId]
    );
    return result.rows;
  }

  // ════════════════════════════════════════════════════════════
  // CONTACTOS
  // ════════════════════════════════════════════════════════════

  async getContactos({ search = '', estado, lista_id, limit = 50, offset = 0 } = {}) {
    const params = [];
    const conditions = ['ec.deleted_at IS NULL'];
    let i = 1;

    if (search) {
      conditions.push(`(ec.nombre ILIKE $${i} OR ec.correo ILIKE $${i} OR comp.name ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (estado) {
      conditions.push(`ec.estado = $${i++}`);
      params.push(estado);
    }
    if (lista_id) {
      conditions.push(`EXISTS (SELECT 1 FROM email_lista_contactos lc WHERE lc.lista_id = $${i++} AND lc.contacto_id = ec.id)`);
      params.push(lista_id);
    }

    params.push(limit, offset);

    const sql = `
      SELECT ec.*, comp.name AS empresa_nombre
      FROM email_contactos ec
      LEFT JOIN companies comp ON comp.id = ec.empresa_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ec.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const countSql = `
      SELECT COUNT(*) FROM email_contactos ec
      LEFT JOIN companies comp ON comp.id = ec.empresa_id
      WHERE ${conditions.join(' AND ')}
    `;

    const [rows, count] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)),
    ]);

    return { data: rows.rows, total: parseInt(count.rows[0].count) };
  }

  async getContactoById(id) {
    const result = await query(
      `SELECT ec.*, comp.name AS empresa_nombre
       FROM email_contactos ec
       LEFT JOIN companies comp ON comp.id = ec.empresa_id
       WHERE ec.id = $1 AND ec.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getContactoByCorreo(correo) {
    const result = await query(
      `SELECT * FROM email_contactos WHERE correo = $1 AND deleted_at IS NULL`,
      [correo.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  async getContactoByToken(token) {
    const result = await query(
      `SELECT ec.*, comp.name AS empresa_nombre
       FROM email_contactos ec
       LEFT JOIN companies comp ON comp.id = ec.empresa_id
       WHERE ec.unsubscribe_token = $1 AND ec.deleted_at IS NULL`,
      [token]
    );
    return result.rows[0] || null;
  }

  async createContacto(data) {
    const { contact_id, empresa_id, nombre, correo, estado, origen, consentimiento_tipo, consentimiento_fuente } = data;
    const result = await query(
      `INSERT INTO email_contactos (contact_id, empresa_id, nombre, correo, estado, origen, consentimiento_tipo, consentimiento_fecha, consentimiento_fuente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       RETURNING *`,
      [
        contact_id || null,
        empresa_id || null,
        nombre,
        correo.toLowerCase().trim(),
        estado || 'activo',
        origen || 'manual',
        consentimiento_tipo || 'relacion_comercial',
        consentimiento_fuente || 'Registro manual',
      ]
    );
    return result.rows[0];
  }

  async updateContacto(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['nombre', 'correo', 'estado', 'empresa_id', 'origen', 'consentimiento_tipo', 'consentimiento_fuente'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(key === 'correo' ? data[key].toLowerCase().trim() : data[key]);
      }
    }
    if ('consentimiento_tipo' in data || 'consentimiento_fuente' in data) {
      fields.push(`consentimiento_fecha = NOW()`);
    }
    if (fields.length === 0) return this.getContactoById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE email_contactos SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteContacto(id) {
    const result = await query(
      `UPDATE email_contactos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async marcarContactoBaja(id, campana_id = null, motivo = null) {
    await query(
      `UPDATE email_contactos SET estado = 'baja', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await query(
      `INSERT INTO email_unsubscribes (contacto_id, campana_id, motivo) VALUES ($1, $2, $3)`,
      [id, campana_id || null, motivo || null]
    );
  }

  async marcarContactoRebotado(id) {
    await query(
      `UPDATE email_contactos SET estado = 'rebotado', updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async agregarContactoALista(listaId, contactoId) {
    await query(
      `INSERT INTO email_lista_contactos (lista_id, contacto_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [listaId, contactoId]
    );
  }

  async quitarContactoDeLista(listaId, contactoId) {
    await query(
      `DELETE FROM email_lista_contactos WHERE lista_id = $1 AND contacto_id = $2`,
      [listaId, contactoId]
    );
  }

  /**
   * Importa contactos desde companies o contacts del CRM
   * Retorna { creados, ya_existian, errores }
   */
  async importarDesdeEmpresa(empresaId, listaId) {
    // Traer empresa y su email de contacto principal
    const empresas = await query(
      `SELECT id, name, COALESCE(email_facturacion, email_operaciones, phone) AS correo_ref,
              email_facturacion, email_operaciones
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
      [empresaId]
    );
    if (empresas.rows.length === 0) return { creados: 0, ya_existian: 0, errores: ['Empresa no encontrada'] };

    const empresa = empresas.rows[0];
    const emails = [empresa.email_facturacion, empresa.email_operaciones]
      .filter(e => e && e.includes('@'));

    // Traer contactos de la empresa con email
    const contactos = await query(
      `SELECT first_name, last_name, email FROM contacts
       WHERE company_id = $1 AND email IS NOT NULL AND deleted_at IS NULL`,
      [empresaId]
    );

    const todos = [
      ...emails.map(e => ({
        nombre: empresa.name,
        correo: e,
        empresa_id: empresaId,
        origen: 'importado_empresa',
        consentimiento_tipo: 'relacion_comercial',
        consentimiento_fuente: 'Importado Empresas - relacion comercial preexistente'
      })),
      ...contactos.rows.map(c => ({
        nombre: `${c.first_name} ${c.last_name || ''}`.trim(),
        correo: c.email,
        empresa_id: empresaId,
        origen: 'importado_crm',
        consentimiento_tipo: 'relacion_comercial',
        consentimiento_fuente: 'Importado CRM - relacion comercial preexistente'
      })),
    ].filter(c => c.correo && c.correo.includes('@'));

    let creados = 0;
    let ya_existian = 0;
    const errores = [];

    for (const item of todos) {
      try {
        const existe = await this.getContactoByCorreo(item.correo);
        if (existe) {
          // Si ya existe, actualizamos nombre y empresa_id (dejamos estado, origen y consentimiento intactos)
          await this.updateContacto(existe.id, {
            nombre: item.nombre,
            empresa_id: item.empresa_id
          });
          await this.agregarContactoALista(listaId, existe.id);
          ya_existian++;
        } else {
          const nuevo = await this.createContacto(item);
          await this.agregarContactoALista(listaId, nuevo.id);
          creados++;
        }
      } catch (err) {
        errores.push(`${item.correo}: ${err.message}`);
      }
    }

    return { creados, ya_existian, errores };
  }

  // ════════════════════════════════════════════════════════════
  // PLANTILLAS
  // ════════════════════════════════════════════════════════════

  async getPlantillas({ search = '', limit = 50, offset = 0 } = {}) {
    const params = [];
    let where = 'deleted_at IS NULL';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (nombre ILIKE $1 OR asunto ILIKE $1)`;
    }
    params.push(limit, offset);

    const sql = `
      SELECT * FROM email_plantillas
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  async getPlantillaById(id) {
    const result = await query(
      `SELECT * FROM email_plantillas WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async createPlantilla(data) {
    const { nombre, asunto, cuerpo_handlebars, variables_disponibles } = data;
    const result = await query(
      `INSERT INTO email_plantillas (nombre, asunto, cuerpo_handlebars, variables_disponibles)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, asunto, cuerpo_handlebars, JSON.stringify(variables_disponibles || [])]
    );
    return result.rows[0];
  }

  async updatePlantilla(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['nombre', 'asunto', 'cuerpo_handlebars', 'variables_disponibles'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(key === 'variables_disponibles' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    if (fields.length === 0) return this.getPlantillaById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE email_plantillas SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deletePlantilla(id) {
    const result = await query(
      `UPDATE email_plantillas SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ════════════════════════════════════════════════════════════
  // CAMPAÑAS
  // ════════════════════════════════════════════════════════════

  async getCampanas({ search = '', estado, limit = 50, offset = 0 } = {}) {
    const params = [];
    const conditions = ['c.deleted_at IS NULL'];
    let i = 1;
    if (search) { conditions.push(`c.nombre ILIKE $${i++}`); params.push(`%${search}%`); }
    if (estado) { conditions.push(`c.estado = $${i++}`); params.push(estado); }
    params.push(limit, offset);

    const sql = `
      SELECT c.*,
        p.nombre AS plantilla_nombre,
        l.nombre AS lista_nombre,
        (u.nombre || ' ' || u.apellido) AS creado_por_nombre
      FROM email_campanas c
      LEFT JOIN email_plantillas p ON p.id = c.plantilla_id
      LEFT JOIN email_listas l ON l.id = c.lista_id
      LEFT JOIN users u ON u.id = c.creado_por
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  async getCampanaById(id) {
    const result = await query(
      `SELECT c.*,
          p.nombre AS plantilla_nombre, p.asunto, p.cuerpo_handlebars,
          l.nombre AS lista_nombre,
          (u.nombre || ' ' || u.apellido) AS creado_por_nombre
       FROM email_campanas c
       LEFT JOIN email_plantillas p ON p.id = c.plantilla_id
       LEFT JOIN email_listas l ON l.id = c.lista_id
       LEFT JOIN users u ON u.id = c.creado_por
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async createCampana(data, userId) {
    const { nombre, plantilla_id, lista_id, estado, programada_para } = data;
    const result = await query(
      `INSERT INTO email_campanas (nombre, plantilla_id, lista_id, estado, programada_para, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, plantilla_id, lista_id, estado || 'borrador', programada_para || null, userId]
    );
    return result.rows[0];
  }

  async updateCampana(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['nombre', 'plantilla_id', 'lista_id', 'estado', 'programada_para'];
    for (const key of allowed) {
      if (key in data) { fields.push(`${key} = $${i++}`); values.push(data[key]); }
    }
    if (fields.length === 0) return this.getCampanaById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE email_campanas SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteCampana(id) {
    const result = await query(
      `UPDATE email_campanas SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Prepara los envíos de una campaña: inserta un registro en email_envios
   * por cada contacto activo de la lista (sin duplicados ni dados de baja)
   */
  async prepararEnviosCampana(campanaId, listaId) {
    // Inserta envíos para todos los contactos activos de la lista
    // ON CONFLICT DO NOTHING para idempotencia
    const result = await query(
      `INSERT INTO email_envios (campana_id, contacto_id)
       SELECT $1, lc.contacto_id
       FROM email_lista_contactos lc
       JOIN email_contactos ec ON ec.id = lc.contacto_id
       WHERE lc.lista_id = $2
         AND ec.estado = 'activo'
         AND ec.deleted_at IS NULL
       ON CONFLICT (campana_id, contacto_id) DO NOTHING
       RETURNING id`,
      [campanaId, listaId]
    );

    const total = result.rows.length;

    // Actualizar contador total en la campaña y cambiar estado
    await query(
      `UPDATE email_campanas
       SET total_envios = $1, estado = 'enviando', updated_at = NOW()
       WHERE id = $2`,
      [total, campanaId]
    );

    return total;
  }

  // ════════════════════════════════════════════════════════════
  // ENVÍOS
  // ════════════════════════════════════════════════════════════

  async getEnviosDeCampana(campanaId, { limit = 100, offset = 0, estado } = {}) {
    const params = [campanaId];
    let extra = '';
    if (estado) { extra = ` AND e.estado = $2`; params.push(estado); }
    params.push(limit, offset);

    const sql = `
      SELECT e.*, ec.nombre, ec.correo, ec.empresa_id,
             comp.name AS empresa_nombre
      FROM email_envios e
      JOIN email_contactos ec ON ec.id = e.contacto_id
      LEFT JOIN companies comp ON comp.id = ec.empresa_id
      WHERE e.campana_id = $1 ${extra}
      ORDER BY e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  async getLotePendiente(campanaId, limite = 25) {
    const result = await query(
      `SELECT e.id AS envio_id, e.contacto_id,
              ec.nombre, ec.correo, ec.empresa_id, ec.unsubscribe_token,
              comp.name AS empresa_nombre
       FROM email_envios e
       JOIN email_contactos ec ON ec.id = e.contacto_id
       LEFT JOIN companies comp ON comp.id = ec.empresa_id
       WHERE e.campana_id = $1 AND e.estado = 'pendiente'
       ORDER BY e.created_at ASC
       LIMIT $2`,
      [campanaId, limite]
    );
    return result.rows;
  }

  async marcarEnvioEnviado(envioId, messageId) {
    await query(
      `UPDATE email_envios
       SET estado = 'enviado', message_id_graph = $1, enviado_at = NOW()
       WHERE id = $2`,
      [messageId, envioId]
    );
    await query(
      `UPDATE email_campanas SET enviados = enviados + 1, updated_at = NOW()
       WHERE id = (SELECT campana_id FROM email_envios WHERE id = $1)`,
      [envioId]
    );
  }

  async marcarEnvioFallido(envioId, errorMsg) {
    await query(
      `UPDATE email_envios SET estado = 'fallido', error_mensaje = $1 WHERE id = $2`,
      [errorMsg, envioId]
    );
    await query(
      `UPDATE email_campanas SET fallidos = fallidos + 1, updated_at = NOW()
       WHERE id = (SELECT campana_id FROM email_envios WHERE id = $1)`,
      [envioId]
    );
  }

  async registrarApertura(envioId) {
    // Solo registra la primera apertura
    await query(
      `UPDATE email_envios
       SET abierto_at = COALESCE(abierto_at, NOW())
       WHERE id = $1`,
      [envioId]
    );
    // Incrementar contador en campaña solo si es primera apertura
    await query(
      `UPDATE email_campanas SET abiertos = abiertos + 1, updated_at = NOW()
       WHERE id = (
         SELECT campana_id FROM email_envios
         WHERE id = $1 AND abierto_at IS NULL
       )`,
      [envioId]
    );
  }

  async registrarClick(envioId, urlOriginal) {
    await query(
      `INSERT INTO email_clicks (envio_id, url_original) VALUES ($1, $2)`,
      [envioId, urlOriginal]
    );
    await query(
      `UPDATE email_envios SET click_count = click_count + 1 WHERE id = $1`,
      [envioId]
    );
    await query(
      `UPDATE email_campanas SET clicks = clicks + 1, updated_at = NOW()
       WHERE id = (SELECT campana_id FROM email_envios WHERE id = $1)`,
      [envioId]
    );
  }

  async getEnvioById(envioId) {
    const result = await query(
      `SELECT e.*, ec.correo, ec.nombre, ec.unsubscribe_token, ec.empresa_id
       FROM email_envios e
       JOIN email_contactos ec ON ec.id = e.contacto_id
       WHERE e.id = $1`,
      [envioId]
    );
    return result.rows[0] || null;
  }

  async verificarCampanaCompleta(campanaId) {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes
       FROM email_envios WHERE campana_id = $1`,
      [campanaId]
    );
    if (parseInt(result.rows[0].pendientes) === 0) {
      await query(
        `UPDATE email_campanas SET estado = 'completada', updated_at = NOW() WHERE id = $1`,
        [campanaId]
      );
      return true;
    }
    return false;
  }

  // ════════════════════════════════════════════════════════════
  // JOBS — buscar campañas listas para enviar
  // ════════════════════════════════════════════════════════════

  async getCampanasParaEnviar() {
    const result = await query(
      `SELECT id, nombre, plantilla_id, lista_id
       FROM email_campanas
       WHERE deleted_at IS NULL
         AND estado IN ('enviando', 'programada')
         AND (programada_para IS NULL OR programada_para <= NOW())
       ORDER BY programada_para ASC NULLS FIRST`
    );
    return result.rows;
  }

  // ════════════════════════════════════════════════════════════
  // REBOTES — lectura de email_envios para marcar desde NDR
  // ════════════════════════════════════════════════════════════

  async marcarEnvioRebotado(envioId) {
    await query(
      `UPDATE email_envios SET estado = 'rebotado' WHERE id = $1`,
      [envioId]
    );
    // Marcar el contacto como rebotado
    await query(
      `UPDATE email_contactos SET estado = 'rebotado', updated_at = NOW()
       WHERE id = (SELECT contacto_id FROM email_envios WHERE id = $1)`,
      [envioId]
    );
  }

  async getEnviosPorCorreo(correo) {
    const result = await query(
      `SELECT e.id FROM email_envios e
       JOIN email_contactos ec ON ec.id = e.contacto_id
       WHERE ec.correo = $1 AND e.estado = 'enviado'
       ORDER BY e.enviado_at DESC LIMIT 1`,
      [correo.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }
}

export const emailMarketingRepository = new EmailMarketingRepository();
