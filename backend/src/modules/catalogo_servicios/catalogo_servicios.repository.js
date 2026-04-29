import { query, withTransaction } from '../../config/database.js';

export class CatalogoServiciosRepository {
  async findAll({ search, is_active, limit = 100 }) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (is_active !== undefined && is_active !== 'all') {
      conditions.push(`is_active = $${i++}`);
      params.push(is_active === 'true' || is_active === true);
    }
    if (search?.trim()) {
      conditions.push(`(nombre ILIKE $${i} OR codigo ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await query(
      `SELECT * FROM catalogo_servicios ${where} ORDER BY is_active DESC, nombre ASC LIMIT $${i}`,
      params
    );
    return result.rows;
  }

  async findById(id) {
    const result = await query(`SELECT * FROM catalogo_servicios WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async generarCodigo() {
    return await withTransaction(async (client) => {
      const res = await client.query(`SELECT ultimo_valor FROM consecutivos WHERE id = 'SRV' FOR UPDATE`);
      const current = res.rows[0]?.ultimo_valor || 0;
      const next = current + 1;
      await client.query(
        `INSERT INTO consecutivos (id, ultimo_valor) VALUES ('SRV', $1)
         ON CONFLICT (id) DO UPDATE SET ultimo_valor = EXCLUDED.ultimo_valor`,
        [next]
      );
      return `SRV-${String(next).padStart(4, '0')}`;
    });
  }

  async create(data) {
    const codigo = await this.generarCodigo();
    const { nombre, descripcion, precio_base, cantidad, unidad, tipo } = data;
    const finalTipo = tipo || 'Servicio';

    return await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO catalogo_servicios (codigo, nombre, descripcion, precio_base, cantidad, unidad, tipo)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [codigo, nombre, descripcion || null, precio_base || 0, cantidad || 1, unidad || (finalTipo === 'Servicio' ? 'hora' : 'unidad'), finalTipo]
      );

      if (finalTipo === 'Producto') {
        await client.query(
          `INSERT INTO inventory_items
            (sku, name, description, category, unit, unit_cost, unit_price, stock_current, stock_minimum, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [codigo, nombre, descripcion || null, 'General', unidad || 'unidad', 0, precio_base || 0, 1, cantidad || 1, true]
        );
      }
      return result.rows[0];
    });
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['codigo', 'nombre', 'descripcion', 'precio_base', 'cantidad', 'unidad', 'is_active', 'tipo'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE catalogo_servicios SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(
      `DELETE FROM catalogo_servicios WHERE id = $1 RETURNING id`, [id]
    );
    return result.rows[0] || null;
  }
}
