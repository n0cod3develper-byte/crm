import { query } from '../../config/database.js';

export class CentrosCostosRepository {
  async findAll({ empresa_id, search, estado, limit = 50, cursor }) {
    const conditions = ['cc.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (empresa_id && empresa_id !== 'undefined' && empresa_id !== 'null') {
      conditions.push(`cc.empresa_id = $${i++}`);
      params.push(empresa_id);
    }
    if (estado !== undefined && estado !== 'all') {
      conditions.push(`cc.estado = $${i++}`);
      params.push(estado === 'true' || estado === true);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(cc.nombre ILIKE $${i} OR c.name ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`cc.created_at < (SELECT created_at FROM centros_costos WHERE id = $${i++})`);
      params.push(cursor);
    }
    
    params.push(limit + 1);

    const sql = `
      SELECT cc.*, c.name AS empresa_nombre
      FROM centros_costos cc
      JOIN companies c ON c.id = cc.empresa_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY cc.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findById(id) {
    const sql = `
      SELECT cc.*, c.name AS empresa_nombre
      FROM centros_costos cc
      JOIN companies c ON c.id = cc.empresa_id
      WHERE cc.id = $1 AND cc.deleted_at IS NULL
    `;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  async create(data) {
    const { empresa_id, nombre, descripcion, estado } = data;
    const res = await query(
      `INSERT INTO centros_costos (empresa_id, nombre, descripcion, estado)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [empresa_id, nombre, descripcion || null, estado ?? true]
    );
    return res.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['empresa_id', 'nombre', 'descripcion', 'estado'];

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
      `UPDATE centros_costos SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const res = await query(
      `UPDATE centros_costos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return res.rows[0] || null;
  }

  // ---- Items Management ----
  
  async getItems(centro_costo_id) {
    const sql = `
      SELECT 
        i.id, i.name, i.codigo_interno, i.tipo, i.unidad_cobro, 
        i.unit_price, i.precio_servicio, cci.created_at as asignado_el
      FROM centro_costo_items cci
      JOIN inventario i ON i.id = cci.inventario_id
      WHERE cci.centro_costo_id = $1
      ORDER BY cci.created_at DESC
    `;
    const res = await query(sql, [centro_costo_id]);
    return res.rows;
  }

  async addItem(centro_costo_id, inventario_id) {
    const sql = `
      INSERT INTO centro_costo_items (centro_costo_id, inventario_id)
      VALUES ($1, $2)
      ON CONFLICT (centro_costo_id, inventario_id) DO NOTHING
      RETURNING *
    `;
    const res = await query(sql, [centro_costo_id, inventario_id]);
    return res.rows[0];
  }

  async removeItem(centro_costo_id, inventario_id) {
    const sql = `
      DELETE FROM centro_costo_items
      WHERE centro_costo_id = $1 AND inventario_id = $2
      RETURNING *
    `;
    const res = await query(sql, [centro_costo_id, inventario_id]);
    return res.rows[0];
  }
}

