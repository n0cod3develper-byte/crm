import { query } from '../../config/database.js';

export class SupplierQuotesRepository {
  async findAll({ providerId, companyId, status, search, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (providerId && providerId !== 'undefined') {
      conditions.push(`sq.proveedor_id = $${i++}`);
      params.push(providerId);
    }
    if (companyId && companyId !== 'undefined') {
      conditions.push(`sq.company_id = $${i++}`);
      params.push(companyId);
    }
    if (status && status !== 'undefined') {
      conditions.push(`sq.estado = $${i++}`);
      params.push(status);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(sq.consecutivo ILIKE $${i} OR prov.razon_social ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`sq.created_at < (SELECT created_at FROM supplier_quotes WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT sq.*, prov.razon_social AS provider_name, comp.name AS company_name
      FROM supplier_quotes sq
      LEFT JOIN proveedores prov ON prov.id = sq.proveedor_id
      LEFT JOIN companies comp ON comp.id = sq.company_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sq.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findById(id) {
    const res = await query(
      `SELECT sq.*, 
        prov.razon_social AS provider_name,
        prov.telefono_principal AS provider_phone,
        prov.numero_documento AS provider_nit,
        comp.name AS company_name,
        (con.first_name || ' ' || COALESCE(con.last_name, '')) AS contact_name,
        con.phone AS contact_phone
       FROM supplier_quotes sq
       LEFT JOIN proveedores prov ON prov.id = sq.proveedor_id
       LEFT JOIN companies comp ON comp.id = sq.company_id
       LEFT JOIN contacts con ON con.id = sq.contact_id
       WHERE sq.id = $1`,
      [id]
    );
    const quote = res.rows[0];
    if (!quote) return null;
    const itemsRes = await query(
      `SELECT sqi.*, p.razon_social AS proveedor_nombre, c.name AS company_name
       FROM supplier_quote_items sqi 
       LEFT JOIN proveedores p ON p.id = sqi.proveedor_id
       LEFT JOIN companies c ON c.id = sqi.company_id
       WHERE sqi.supplier_quote_id = $1 ORDER BY sqi.id ASC`, 
      [id]
    );
    quote.items = itemsRes.rows;
    return quote;
  }

  async create(data, userId) {
    const consecutivo = `SQ-${Date.now().toString().slice(-6)}`;
    const {
      proveedor_id,
      contact_id,
      telefono_contacto,
      company_id,
      estado = 'BORRADOR',
      margen_utilidad = 23.00,
      subtotal = 0,
      total = 0,
      validez_oferta,
      forma_pago,
      estado_comercial = 'EN_ESPERA',
      numero_cotizacion,
      iva = 19.00,
      items = []
    } = data;

    const res = await query(
      `INSERT INTO supplier_quotes (consecutivo, proveedor_id, contact_id, telefono_contacto, estado, subtotal, total, validez_oferta, forma_pago, estado_comercial, numero_cotizacion, iva, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [consecutivo, proveedor_id || null, contact_id || null, telefono_contacto || null, estado, subtotal, total,
       validez_oferta || null, forma_pago || null, estado_comercial, numero_cotizacion || null, iva, userId]
    );
    const quote = res.rows[0];

    // Insert items if any
    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await query(
          `INSERT INTO supplier_quote_items (supplier_quote_id, inventario_id, codigo, cantidad, precio_unitario, descuento, comentarios, proveedor_id, company_id, margen_utilidad, descripcion_manual)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [quote.id, it.inventario_id || null, it.codigo || null, it.cantidad, it.precio_unitario,
           it.descuento || 0, it.comentarios || null, it.proveedor_id || null,
           it.company_id || null, it.margen_utilidad || 0, it.descripcion_manual || null]
        );
      }
    }
    return this.findById(quote.id);
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['proveedor_id','contact_id','telefono_contacto','estado','subtotal','total','validez_oferta','forma_pago','estado_comercial','numero_cotizacion','iva'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await query(`UPDATE supplier_quotes SET ${fields.join(', ')} WHERE id = $${i}`, values);
    }
    // Replace items if supplied
    if (Array.isArray(data.items)) {
      await query(`DELETE FROM supplier_quote_items WHERE supplier_quote_id = $1`, [id]);
      for (let j = 0; j < data.items.length; j++) {
        const it = data.items[j];
        await query(
          `INSERT INTO supplier_quote_items (supplier_quote_id, inventario_id, codigo, cantidad, precio_unitario, descuento, comentarios, proveedor_id, company_id, margen_utilidad, descripcion_manual)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, it.inventario_id || null, it.codigo || null, it.cantidad, it.precio_unitario,
           it.descuento || 0, it.comentarios || null, it.proveedor_id || null,
           it.company_id || null, it.margen_utilidad || 0, it.descripcion_manual || null]
        );
      }
    }
    return this.findById(id);
  }

  async delete(id) {
    const res = await query(`DELETE FROM supplier_quotes WHERE id = $1 RETURNING id`, [id]);
    return res.rows[0] || null;
  }

  // Helper to get provider details
  async getProviderById(providerId) {
    const res = await query(`SELECT * FROM proveedores WHERE id = $1`, [providerId]);
    return res.rows[0];
  }

  // Update only the state field
  async updateState(id, newState) {
    await query(`UPDATE supplier_quotes SET estado = $1, updated_at = NOW() WHERE id = $2`, [newState, id]);
    return this.findById(id);
  }

  // Calculate subtotal and total using iva
  async calculateTotal(id) {
    const itemsRes = await query(`SELECT cantidad, precio_unitario, descuento FROM supplier_quote_items WHERE supplier_quote_id = $1`, [id]);
    const items = itemsRes.rows;
    const subtotal = items.reduce((sum, it) => sum + Math.max(0, (it.cantidad * it.precio_unitario) - (it.descuento || 0)), 0);
    const quoteRes = await query(`SELECT iva FROM supplier_quotes WHERE id = $1`, [id]);
    const iva = quoteRes.rows[0]?.iva || 0;
    const total = subtotal * (1 + iva / 100);
    await query(`UPDATE supplier_quotes SET subtotal = $1, total = $2, updated_at = NOW() WHERE id = $3`, [subtotal, total, id]);
    return { subtotal, total };
  }

  // Adjust stock for each item
  async adjustStockForQuote(id) {
    const itemsRes = await query(`SELECT inventario_id, cantidad FROM supplier_quote_items WHERE supplier_quote_id = $1`, [id]);
    for (const item of itemsRes.rows) {
      await query(`UPDATE inventario SET stock_actual = stock_actual - $1 WHERE id = $2`, [item.cantidad, item.inventario_id]);
    }
  }
}

