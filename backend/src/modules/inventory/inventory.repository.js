import { query } from '../../config/database.js';

export class InventoryRepository {
  async findAll({ category, search, isActive, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (category && category !== 'undefined') {
      conditions.push(`categoria_id = $${i++}`); // Se cambió a categoria_id
      params.push(category);
    }
    if (isActive !== undefined && isActive !== 'undefined' && isActive !== '') {
      conditions.push(`is_active = $${i++}`);
      params.push(isActive === 'true');
    }
    if (search && search.trim() !== '') {
      conditions.push(`(name ILIKE $${i} OR sku ILIKE $${i} OR codigo_interno ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM inventario WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT i.*, 
             c.nombre as familia_nombre, 
             u.codigo_ubicacion as ubicacion_fisica
      FROM inventario i
      LEFT JOIN catalogo_categorias c ON i.categoria_id = c.id
      LEFT JOIN ubicaciones_bodega u ON i.ubicacion_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.name ASC
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
    const result = await query(`SELECT * FROM inventario WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async create(data) {
    const { sku, name, description, categoria_id, ubicacion_id, marca, unit, costo_reposicion, unit_price, stock_actual, stock_minimum, is_active, tipo } = data;
    const result = await query(
      `INSERT INTO inventario
        (sku, name, description, categoria_id, ubicacion_id, marca, unit, costo_reposicion, unit_price, stock_actual, stock_minimum, is_active, tipo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [sku || null, name, description || null, categoria_id || null, ubicacion_id || null, marca || null, unit || 'unidad',
       costo_reposicion || 0, unit_price || 0, stock_actual || 0, stock_minimum || 0, is_active ?? true, tipo || 'PRODUCTO']
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['sku', 'name', 'description', 'categoria_id', 'ubicacion_id', 'marca', 'unit', 'costo_reposicion', 'unit_price', 'stock_actual', 'stock_minimum', 'is_active', 'tipo', 'costo_promedio_ponderado', 'precio_piso', 'precio_venta_sugerido'];
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
      `UPDATE inventario SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM inventario WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}
