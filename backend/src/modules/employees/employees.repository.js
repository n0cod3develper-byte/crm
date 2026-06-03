import { query } from '../../config/database.js';

export class EmployeesRepository {
  async findAll({ position, status, search, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (position && position !== 'all') {
      conditions.push(`position = $${i++}`);
      params.push(position);
    }
    if (status && status !== 'all') {
      conditions.push(`status = $${i++}`);
      params.push(status);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(full_name ILIKE $${i} OR numero_documento ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM employees WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT e.*,
             u.nombre AS user_nombre,
             u.apellido AS user_apellido,
             u.email AS user_email
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
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
      `SELECT e.*,
              u.nombre AS user_nombre,
              u.apellido AS user_apellido,
              u.email AS user_email
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const { full_name, phone, email, position, status, user_id, hourly_rate, tipo_documento, numero_documento, departamento } = data;
    const result = await query(
      `INSERT INTO employees (full_name, phone, email, position, status, user_id, hourly_rate, tipo_documento, numero_documento, departamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [full_name, phone, email, position, status || 'Activo', user_id || null, hourly_rate || 0, tipo_documento || null, numero_documento || null, departamento || null]
    );
    return result.rows[0];
  }

  async bulkCreate(dataArray) {
    if (!dataArray || dataArray.length === 0) return [];
    
    const values = [];
    const placeholders = [];
    let i = 1;

    for (const data of dataArray) {
      const { full_name, phone, email, position, status, user_id, hourly_rate, identification, company } = data;
      placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      values.push(
        full_name,
        phone || null,
        email,
        position,
        status || 'Activo',
        user_id || null,
        hourly_rate || 0,
        identification || null,
        company || null
      );
    }

    const queryStr = `
      INSERT INTO employees (full_name, phone, email, position, status, user_id, hourly_rate, identification, company)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (email) DO NOTHING
      RETURNING *
    `;

    const result = await query(queryStr, values);
    return result.rows;
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['full_name', 'phone', 'email', 'position', 'status', 'user_id', 'hourly_rate', 'tipo_documento', 'numero_documento', 'departamento'];
    
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    
    if (fields.length === 0) return this.findById(id);
    
    values.push(id);
    const result = await query(
      `UPDATE employees SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM employees WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}
