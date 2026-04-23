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
      conditions.push(`full_name ILIKE $${i++}`);
      params.push(`%${search.trim()}%`);
    }
    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM employees WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT * FROM employees
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
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
      `SELECT * FROM employees WHERE id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const { full_name, phone, email, position, status, user_id, hourly_rate } = data;
    const result = await query(
      `INSERT INTO employees (full_name, phone, email, position, status, user_id, hourly_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [full_name, phone, email, position, status || 'Activo', user_id || null, hourly_rate || 0]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['full_name', 'phone', 'email', 'position', 'status', 'user_id', 'hourly_rate'];
    
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
