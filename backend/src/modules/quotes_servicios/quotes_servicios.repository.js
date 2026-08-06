import { query, withTransaction } from '../../config/database.js';

export class QuotesServiciosRepository {
  async findAll({ companyId, search, status, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (companyId && companyId !== 'undefined') {
      conditions.push(`qs.company_id = $${i++}`);
      params.push(companyId);
    }
    if (status && status !== 'undefined') {
      conditions.push(`qs.estado = $${i++}`);
      params.push(status);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(qs.consecutivo ILIKE $${i} OR comp.name ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`qs.created_at < (SELECT created_at FROM quotes_servicios WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT qs.*,
        comp.name AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name,'') AS contact_name,
        cs.nombre AS servicio_nombre,
        (u.nombre || ' ' || u.apellido) AS created_by_name
      FROM quotes_servicios qs
      LEFT JOIN companies comp         ON comp.id = qs.company_id
      LEFT JOIN contacts ct            ON ct.id = qs.contact_id
      LEFT JOIN catalogo_servicios cs  ON cs.id = qs.catalogo_servicio_id
      LEFT JOIN users u                ON u.id = qs.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY qs.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findById(id) {
    const sql = `
      SELECT qs.*,
        comp.name AS company_name, comp.nit AS company_nit, comp.phone AS company_phone,
        ct.first_name || ' ' || COALESCE(ct.last_name,'') AS contact_name, ct.email AS contact_email, ct.phone AS contact_phone,
        cs.nombre AS servicio_nombre,
        (u.nombre || ' ' || u.apellido) AS created_by_name
      FROM quotes_servicios qs
      LEFT JOIN companies comp         ON comp.id = qs.company_id
      LEFT JOIN contacts ct            ON ct.id = qs.contact_id
      LEFT JOIN catalogo_servicios cs  ON cs.id = qs.catalogo_servicio_id
      LEFT JOIN users u                ON u.id = qs.created_by
      WHERE qs.id = $1
    `;
    const result = await query(sql, [id]);
    const quote = result.rows[0];
    if (!quote) return null;

    const itemsResult = await query(
      `SELECT i.*, cs.nombre AS servicio_nombre 
       FROM quotes_servicios_items i 
       LEFT JOIN catalogo_servicios cs ON i.catalogo_servicio_id = cs.id
       WHERE i.quote_servicio_id = $1 ORDER BY i.created_at ASC`,
      [id]
    );
    quote.items = itemsResult.rows;

    return quote;
  }

  async create(data, userId) {
    return await withTransaction(async (client) => {
      // 1. Obtener consecutivo
      const resSeq = await client.query(`
        UPDATE consecutivos
        SET ultimo_valor = ultimo_valor + 1
        WHERE id = 'cotizacion_servicio'
        RETURNING ultimo_valor
      `);
      if (resSeq.rows.length === 0) {
        throw new Error('No se encontró el consecutivo para cotizacion_servicio');
      }
      const numFormatted = resSeq.rows[0].ultimo_valor.toString().padStart(4, '0');
      const consecutivo = `CS-${numFormatted}`;

      // 2. Insertar quote
      const { 
        company_id, contact_id, fecha, asunto, direccion_invitacion, 
        ciudad_envio, catalogo_servicio_id, descripcion, estado, 
        subtotal, iva_valor, total, items 
      } = data;

      const resInsert = await client.query(`
        INSERT INTO quotes_servicios (
          consecutivo, company_id, contact_id, fecha, asunto, direccion_invitacion,
          ciudad_envio, catalogo_servicio_id, descripcion, estado, subtotal, iva_valor, total, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
      `, [
        consecutivo, company_id, contact_id || null, fecha || new Date(), asunto,
        direccion_invitacion, ciudad_envio, catalogo_servicio_id || null,
        descripcion, estado || 'BORRADOR', subtotal || 0, iva_valor || 0, total || 0, userId
      ]);

      const quote = resInsert.rows[0];

      // 3. Insertar items
      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(`
            INSERT INTO quotes_servicios_items (
              quote_servicio_id, descripcion, cantidad, valor_unitario, subtotal, aplica_iva, iva_valor, catalogo_servicio_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            quote.id, item.descripcion, item.cantidad || 1, item.valor_unitario || 0,
            item.subtotal || 0, item.aplica_iva || false, item.iva_valor || 0, item.catalogo_servicio_id || null
          ]);
        }
      }

      return quote;
    });
  }

  async update(id, data) {
    return await withTransaction(async (client) => {
      const { 
        company_id, contact_id, fecha, asunto, direccion_invitacion, 
        ciudad_envio, catalogo_servicio_id, descripcion, estado, 
        subtotal, iva_valor, total, items 
      } = data;

      const resUpdate = await client.query(`
        UPDATE quotes_servicios SET
          company_id = $1, contact_id = $2, fecha = $3, asunto = $4,
          direccion_invitacion = $5, ciudad_envio = $6, catalogo_servicio_id = $7,
          descripcion = $8, estado = $9, subtotal = $10, iva_valor = $11, total = $12
        WHERE id = $13 RETURNING *
      `, [
        company_id, contact_id || null, fecha, asunto,
        direccion_invitacion, ciudad_envio, catalogo_servicio_id || null,
        descripcion, estado, subtotal || 0, iva_valor || 0, total || 0, id
      ]);

      const quote = resUpdate.rows[0];
      if (!quote) throw new Error('Cotización no encontrada');

      // Recrear items
      await client.query(`DELETE FROM quotes_servicios_items WHERE quote_servicio_id = $1`, [id]);
      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(`
            INSERT INTO quotes_servicios_items (
              quote_servicio_id, descripcion, cantidad, valor_unitario, subtotal, aplica_iva, iva_valor, catalogo_servicio_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            id, item.descripcion, item.cantidad || 1, item.valor_unitario || 0,
            item.subtotal || 0, item.aplica_iva || false, item.iva_valor || 0, item.catalogo_servicio_id || null
          ]);
        }
      }

      return quote;
    });
  }

  async updateStatus(id, status) {
    const res = await query(
      `UPDATE quotes_servicios SET estado = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0];
  }

  async delete(id) {
    await query(`DELETE FROM quotes_servicios WHERE id = $1`, [id]);
    return true;
  }
}
