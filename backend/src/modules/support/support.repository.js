import { query } from '../../config/database.js';

// ─── Genera ticket_number único: TKT-YYYYMMDD-XXXX ───────────
async function nextTicketNumber() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TKT-${today}-`;
  const result = await query(
    `SELECT ticket_number FROM support_tickets
     WHERE ticket_number LIKE $1
     ORDER BY ticket_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  if (result.rows.length === 0) return `${prefix}0001`;
  const last = parseInt(result.rows[0].ticket_number.split('-').pop(), 10);
  return `${prefix}${String(last + 1).padStart(4, '0')}`;
}

export class SupportRepository {
  // ─── TICKETS ──────────────────────────────────────────────
  async findAll({ status, priority, assignedTo, companyId, search, limit = 50, cursor }) {
    const conditions = ['st.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (status && status !== 'all') {
      conditions.push(`st.status = $${i++}`);
      params.push(status);
    }
    if (priority && priority !== 'all') {
      conditions.push(`st.priority = $${i++}`);
      params.push(priority);
    }
    if (assignedTo) {
      conditions.push(`st.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (companyId) {
      conditions.push(`st.company_id = $${i++}`);
      params.push(companyId);
    }
    if (search && search.trim()) {
      conditions.push(`(st.title ILIKE $${i} OR st.ticket_number ILIKE $${i} OR st.description ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`st.created_at < (SELECT created_at FROM support_tickets WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT
        st.*,
        co.name          AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name, '') AS contact_name,
        e.full_name      AS assigned_to_name,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = st.id) AS message_count
      FROM support_tickets st
      LEFT JOIN companies co ON co.id = st.company_id
      LEFT JOIN contacts  ct ON ct.id = st.contact_id
      LEFT JOIN employees e  ON e.id  = st.assigned_to
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE st.priority
          WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4
        END,
        CASE st.status
          WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'waiting' THEN 3
          WHEN 'resolved' THEN 4 WHEN 'closed' THEN 5
        END,
        st.updated_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findById(id) {
    const result = await query(`
      SELECT
        st.*,
        co.name          AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name, '') AS contact_name,
        e.full_name      AS assigned_to_name
      FROM support_tickets st
      LEFT JOIN companies co ON co.id = st.company_id
      LEFT JOIN contacts  ct ON ct.id = st.contact_id
      LEFT JOIN employees e  ON e.id  = st.assigned_to
      WHERE st.id = $1 AND st.deleted_at IS NULL
    `, [id]);
    return result.rows[0] || null;
  }

  async create(data, userId) {
    const { title, description, status, priority, company_id, contact_id, assigned_to } = data;
    const ticketNumber = await nextTicketNumber();

    const result = await query(`
      INSERT INTO support_tickets
        (ticket_number, title, description, status, priority, company_id, contact_id, assigned_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      ticketNumber,
      title,
      description || null,
      status || 'open',
      priority || 'medium',
      company_id || null,
      contact_id || null,
      assigned_to || userId,
    ]);
    return result.rows[0];
  }

  async update(id, data) {
    const allowed = ['title','description','status','priority','company_id','contact_id','assigned_to'];
    const fields = [];
    const values = [];
    let i = 1;

    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);

    // Si se resuelve, guardar timestamp
    if (data.status === 'resolved' || data.status === 'closed') {
      fields.push(`resolved_at = NOW()`);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE support_tickets SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(
      `UPDATE support_tickets SET deleted_at = NOW() WHERE id = $1 RETURNING id`, [id]
    );
    return result.rows[0] || null;
  }

  // ─── CONTADORES PARA STATS ────────────────────────────────
  async getStats() {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')        AS open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'waiting')     AS waiting_count,
        COUNT(*) FILTER (WHERE status = 'resolved')    AS resolved_count,
        COUNT(*) FILTER (WHERE priority = 'urgent')    AS urgent_count,
        COUNT(*) FILTER (WHERE priority = 'high')      AS high_count,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600
        ), 1) AS avg_resolution_hours
      FROM support_tickets
      WHERE deleted_at IS NULL
    `);
    return result.rows[0];
  }

  // ─── MENSAJES ─────────────────────────────────────────────
  async findMessages(ticketId) {
    const result = await query(`
      SELECT tm.*, u.full_name AS author_name, u.avatar_url AS author_avatar
      FROM ticket_messages tm
      LEFT JOIN users u ON u.id = tm.created_by
      WHERE tm.ticket_id = $1
      ORDER BY tm.created_at ASC
    `, [ticketId]);
    return result.rows;
  }

  async addMessage(ticketId, { body, is_internal }, userId) {
    // Actualizar updated_at del ticket
    await query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`, [ticketId]);

    const result = await query(`
      INSERT INTO ticket_messages (ticket_id, body, is_internal, created_by)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [ticketId, body, is_internal || false, userId]);
    return result.rows[0];
  }

  async deleteMessage(messageId) {
    const result = await query(`DELETE FROM ticket_messages WHERE id = $1 RETURNING id`, [messageId]);
    return result.rows[0] || null;
  }
}
