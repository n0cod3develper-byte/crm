import { query, withTransaction } from '../../config/database.js';

export class TasksRepository {
  async findAll({ assignedTo, status, relatedType, relatedId, search, priority, type, tags, favorite, limit = 50, cursor, userId, userRole, dateFilter, priorityFilter, userFilter }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (userRole && userRole !== 'admin') {
      conditions.push(`(t.assigned_to = $${i} OR t.created_by = $${i} OR t.supervisor_id = $${i})`);
      params.push(userId);
      i++;
    }


    if (dateFilter && dateFilter !== 'all') {
      const today = new Date();
      let start, end;
      if (dateFilter === 'today') {
        start = new Date(today.setHours(0,0,0,0));
        end = new Date(today.setHours(23,59,59,999));
        conditions.push(`t.due_date BETWEEN $${i} AND $${i+1}`);
        params.push(start, end);
        i += 2;
      } else if (dateFilter === 'week') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        start.setHours(0,0,0,0);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23,59,59,999);
        conditions.push(`t.due_date BETWEEN $${i} AND $${i+1}`);
        params.push(start, end);
        i += 2;
      } else if (dateFilter === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23,59,59,999);
        conditions.push(`t.due_date BETWEEN $${i} AND $${i+1}`);
        params.push(start, end);
        i += 2;
      } else if (dateFilter === 'overdue') {
        conditions.push(`t.due_date < NOW() AND t.status NOT IN ('completed', 'cancelled')`);
      }
    }
    if (priorityFilter && priorityFilter !== 'all') {
      conditions.push(`t.priority = $${i++}`);
      params.push(priorityFilter);
    }
    if (userFilter && userFilter !== 'all') {
      conditions.push(`t.assigned_to = $${i++}`);
      params.push(userFilter);
    }
    if (assignedTo && assignedTo !== 'undefined' && assignedTo !== 'all') {
      conditions.push(`t.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (favorite && favorite === 'true') {
      conditions.push(`t.is_favorite = true`);
    }
    if (status && status !== 'undefined' && status !== 'all') {
      conditions.push(`t.status = $${i++}`);
      params.push(status);
    }
    if (priority && priority !== 'undefined' && priority !== 'all') {
      conditions.push(`t.priority = $${i++}`);
      params.push(priority);
    }
    if (type && type !== 'undefined' && type !== 'all') {
      conditions.push(`t.type = $${i++}`);
      params.push(type);
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
      conditions.push(`t.title ILIKE $${i}`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (tags && tags.length > 0) {
      conditions.push(`t.tags && $${i++}`); // Overlaps array
      params.push(tags);
    }
    if (cursor) {
      // Usar UUID como cursor simple o fecha
      conditions.push(`t.created_at < (SELECT created_at FROM tasks WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1); // Extra para saber si hay más

    const sql = `
      SELECT t.*,
        (u.nombre || ' ' || u.apellido) AS assigned_to_name,
        (cr.nombre || ' ' || cr.apellido) AS created_by_name,
        (sup.nombre || ' ' || sup.apellido) AS supervisor_name
      FROM tasks t
      LEFT JOIN users u  ON u.id  = t.assigned_to
      LEFT JOIN users cr ON cr.id = t.created_by
      LEFT JOIN users sup ON sup.id = t.supervisor_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 1
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
    const sql = `
      SELECT t.*,
        (u.nombre || ' ' || u.apellido) AS assigned_to_name,
        (cr.nombre || ' ' || cr.apellido) AS created_by_name,
        (sup.nombre || ' ' || sup.apellido) AS supervisor_name
      FROM tasks t
      LEFT JOIN users u  ON u.id  = t.assigned_to
      LEFT JOIN users cr ON cr.id = t.created_by
      LEFT JOIN users sup ON sup.id = t.supervisor_id
      WHERE t.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async create(data, userId) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    // Añadimos created_by automáticamente
    keys.push('created_by');
    values.push(userId);

    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(',');
    
    const sql = `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await query(sql, values);
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(val);
    }
    
    if (fields.length === 0) return this.findById(id);
    
    values.push(id);
    const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }

  // --- HISTORIAL ---
  // Historial movido a TasksHistoryRepository

  // --- DASHBOARD / KPI ---
  async getSummaryStats(userId, userRole) {
    let whereClause = "WHERE 1=1";
    let params = [];
    if (userRole !== 'admin') {
      whereClause = "WHERE (assigned_to = $1 OR created_by = $1 OR supervisor_id = $1)";
      params = [userId];
    }

    const sql = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed' AND status != 'cancelled') as overdue_tasks,
        COALESCE(SUM(estimated_minutes), 0) as total_estimated_minutes,
        COALESCE(SUM(spent_minutes), 0) as total_spent_minutes
      FROM tasks
      ${whereClause}
    `;
    const result = await query(sql, params);
    return result.rows[0];
  }

  async getExpiring(userId, userRole) {
    let whereClause = "WHERE t.status NOT IN ('completed', 'cancelled') AND t.due_date IS NOT NULL";
    const params = [];
    let i = 1;

    whereClause += ` AND t.due_date <= (NOW() + INTERVAL '24 hours')`;

    if (userRole !== 'admin') {
      whereClause += ` AND (t.assigned_to = $${i} OR t.created_by = $${i} OR t.supervisor_id = $${i})`;
      params.push(userId);
      i++;
    }

    const sql = `
      SELECT t.id, t.title, t.due_date, t.status, t.priority
      FROM tasks t
      ${whereClause}
      ORDER BY t.due_date ASC
      LIMIT 10
    `;
    const result = await query(sql, params);
    return result.rows;
  }
}

