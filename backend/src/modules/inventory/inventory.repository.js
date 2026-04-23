import { query } from '../../config/database.js';

export class InventoryRepository {
  async findAll({ category, search, isActive, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (category && category !== 'undefined') {
      conditions.push(`category = $${i++}`);
      params.push(category);
    }
    if (isActive !== undefined && isActive !== 'undefined' && isActive !== '') {
      conditions.push(`is_active = $${i++}`);
      params.push(isActive === 'true');
    }
    if (search && search.trim() !== '') {
      conditions.push(`(name ILIKE $${i} OR sku ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM inventory_items WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT *
      FROM inventory_items
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
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

  async findById(id) {
    const result = await query(`SELECT * FROM inventory_items WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async create(data) {
    const { sku, name, description, category, unit, unit_cost, unit_price, stock_current, stock_minimum, is_active } = data;
    const result = await query(
      `INSERT INTO inventory_items
        (sku, name, description, category, unit, unit_cost, unit_price, stock_current, stock_minimum, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [sku || null, name, description || null, category || null, unit || 'unidad',
       unit_cost || 0, unit_price || 0, stock_current || 0, stock_minimum || 0, is_active ?? true]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['sku', 'name', 'description', 'category', 'unit', 'unit_cost', 'unit_price', 'stock_current', 'stock_minimum', 'is_active'];
    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key] === '' ? null : data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE inventory_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM inventory_items WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}
