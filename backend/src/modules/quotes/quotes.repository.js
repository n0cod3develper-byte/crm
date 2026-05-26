import { query } from '../../config/database.js';

export class QuotesRepository {
  async findAll({ companyId, opportunityId, status, search, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (companyId && companyId !== 'undefined') {
      conditions.push(`q.company_id = $${i++}`);
      params.push(companyId);
    }
    if (opportunityId && opportunityId !== 'undefined') {
      conditions.push(`q.opportunity_id = $${i++}`);
      params.push(opportunityId);
    }
    if (status && status !== 'undefined') {
      conditions.push(`q.status = $${i++}`);
      params.push(status);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(q.quote_number ILIKE $${i} OR comp.name ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`q.created_at < (SELECT created_at FROM quotes WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT q.*,
        comp.name AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name,'') AS contact_name,
        o.title AS opportunity_title,
        u.full_name AS created_by_name
      FROM quotes q
      LEFT JOIN companies comp     ON comp.id = q.company_id
      LEFT JOIN contacts ct        ON ct.id = q.contact_id
      LEFT JOIN opportunities o    ON o.id = q.opportunity_id
      LEFT JOIN users u            ON u.id = q.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY q.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findById(id) {
    const result = await query(
      `SELECT q.*,
        comp.name AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name,'') AS contact_name,
        o.title AS opportunity_title,
        u.full_name AS created_by_name
      FROM quotes q
      LEFT JOIN companies comp     ON comp.id = q.company_id
      LEFT JOIN contacts ct        ON ct.id = q.contact_id
      LEFT JOIN opportunities o    ON o.id = q.opportunity_id
      LEFT JOIN users u            ON u.id = q.created_by
      WHERE q.id = $1`, [id]
    );
    const quote = result.rows[0];
    if (!quote) return null;

    const itemsResult = await query(`SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY order_index ASC`, [id]);
    quote.items = itemsResult.rows;

    return quote;
  }

  async create(data, userId) {
    // Generar un número de cotización simple para la demo (ideal: secuencia en DB)
    const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;
    
    const { opportunity_id, company_id, contact_id, status, subtotal, tax_rate, tax_amount, total, currency, valid_until, notes, items } = data;
    
    const result = await query(
      `INSERT INTO quotes 
        (quote_number, opportunity_id, company_id, contact_id, created_by, status, subtotal, tax_rate, tax_amount, total, currency, valid_until, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [quoteNumber, opportunity_id || null, company_id || null, contact_id || null, userId,
       status || 'draft', subtotal || 0, tax_rate || 19.00, tax_amount || 0, total || 0,
       currency || 'COP', valid_until || null, notes || null]
    );
    const quote = result.rows[0];

    // Insertar items si existen
    if (items && Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await query(
          `INSERT INTO quote_items (quote_id, description, quantity, unit_price, discount, order_index)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [quote.id, item.description, item.quantity, item.unit_price, item.discount || 0, i]
        );
      }
    }

    return this.findById(quote.id);
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['opportunity_id','company_id','contact_id','status','subtotal','tax_rate','tax_amount','total','currency','valid_until','notes'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    
    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await query(`UPDATE quotes SET ${fields.join(', ')} WHERE id = $${i}`, values);
    }

    // Si envían items, se reemplazan por completo para mayor simplicidad en el CRUD
    if (data.items && Array.isArray(data.items)) {
      await query(`DELETE FROM quote_items WHERE quote_id = $1`, [id]);
      for (let j = 0; j < data.items.length; j++) {
        const item = data.items[j];
        await query(
          `INSERT INTO quote_items (quote_id, description, quantity, unit_price, discount, order_index)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, item.description, item.quantity, item.unit_price, item.discount || 0, j]
        );
      }
    }

    return this.findById(id);
  }

  async delete(id) {
    // quote_items se eliminan en cascada según la constraint de la DB
    const result = await query(`DELETE FROM quotes WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}

