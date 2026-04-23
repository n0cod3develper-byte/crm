import { query } from '../../config/database.js';

export class EquiposRepository {
  async findAll({ empresa_id, motor, combustible, capacidad_carga, search, limit = 50, cursor }) {
    const conditions = ['e.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (empresa_id) {
      conditions.push(`e.empresa_id = $${i++}`);
      params.push(empresa_id);
    }
    if (motor && motor !== 'all') {
      conditions.push(`e.motor = $${i++}`);
      params.push(motor);
    }
    if (combustible && combustible !== 'all') {
      conditions.push(`e.combustible = $${i++}`);
      params.push(combustible);
    }
    if (capacidad_carga && capacidad_carga !== 'all') {
      conditions.push(`e.capacidad_carga = $${i++}`);
      params.push(capacidad_carga);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(e.marca ILIKE $${i} OR e.modelo ILIKE $${i} OR e.serial ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`e.created_at < (SELECT created_at FROM equipos WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT e.*, c.name AS empresa_nombre
      FROM equipos e
      LEFT JOIN companies c ON c.id = e.empresa_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.created_at DESC
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
    const result = await query(
      `SELECT e.*, c.name AS empresa_nombre, c.nit AS empresa_nit
       FROM equipos e
       LEFT JOIN companies c ON c.id = e.empresa_id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findBySerial(serial) {
    const result = await query(
      `SELECT id FROM equipos WHERE serial = $1 AND deleted_at IS NULL`,
      [serial]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const { marca, modelo, serial, motor, combustible, capacidad_carga, color, empresa_id } = data;
    const result = await query(
      `INSERT INTO equipos (marca, modelo, serial, motor, combustible, capacidad_carga, color, empresa_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [marca, modelo, serial, motor, combustible, capacidad_carga, color, empresa_id]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['marca', 'modelo', 'serial', 'motor', 'combustible', 'capacidad_carga', 'color', 'empresa_id'];
    
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    
    if (fields.length === 0) return this.findById(id);
    
    values.push(id);
    const result = await query(
      `UPDATE equipos SET ${fields.join(', ')}, updated_at = NOW() 
       WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE equipos SET deleted_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByCompany(empresa_id) {
    const result = await query(
      `SELECT * FROM equipos WHERE empresa_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [empresa_id]
    );
    return result.rows;
  }
}
