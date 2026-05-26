import { query } from '../../config/database.js';

export class TasksRepository {
  async findAll({ assignedTo, status, relatedType, relatedId, search, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (assignedTo && assignedTo !== 'undefined') {
      conditions.push(`t.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (status && status !== 'undefined') {
      conditions.push(`t.status = $${i++}`);
      params.push(status);
    }
    if (relatedType && relatedType !== 'undefined') {
      conditions.push(`t.related_type = $${i++}`);
      params.push(relatedType);
    }
    if (relatedId && relatedId !== 'undefined') {
      conditions.push(`t.related_id = $${i++}`);
      params.push(relatedId);
    }
    if (search && search.trim() !== '') {
      conditions.push(`t.title ILIKE $${i++}`);
      params.push(`%${search.trim()}%`);
    }
    if (cursor) {
      conditions.push(`t.created_at < (SELECT created_at FROM tasks WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT t.*,
        u.full_name AS assigned_to_name,
        (cr.nombre || ' ' || cr.apellido) AS created_by_name
      FROM tasks t
      LEFT JOIN users u  ON u.id  = t.assigned_to
      LEFT JOIN users cr ON cr.id = t.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
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
      `SELECT t.*, u.full_name AS assigned_to_name, (cr.nombre || ' ' || cr.apellido) AS created_by_name
       FROM tasks t
       LEFT JOIN users u  ON u.id  = t.assigned_to
       LEFT JOIN users cr ON cr.id = t.created_by
       WHERE t.id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  async create(data, userId) {
    const { title, description, type, status, priority, assigned_to, related_type, related_id, due_date } = data;
    const result = await query(
      `INSERT INTO tasks (title, description, type, status, priority, assigned_to, related_type, related_id, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, description || null, type || 'task', status || 'pending',
       priority || 'medium', assigned_to || userId,
       related_type || null, related_id || null, due_date || null, userId]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['title','description','type','status','priority','assigned_to','related_type','related_id','due_date','completed_at'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const result = await query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async complete(id) {
    const result = await query(
      `UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`, [id]
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}

