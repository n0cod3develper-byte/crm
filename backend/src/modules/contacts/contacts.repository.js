import { query } from '../../config/database.js';

export class ContactsRepository {
  async findAll({ companyId, search, limit = 50, cursor }) {
    const conditions = ['c.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    // Solo filtrar por empresa si el ID es válido
    if (companyId && companyId !== 'undefined' && companyId !== 'null') {
      conditions.push(`c.company_id = $${i++}`);
      params.push(companyId);
    }
    
    if (search && search.trim() !== '') {
      conditions.push(`(c.first_name ILIKE $${i} OR c.last_name ILIKE $${i} OR c.email ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }

    if (cursor) {
      conditions.push(`c.created_at < (SELECT created_at FROM contacts WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT c.*,
        (u.nombre || ' ' || u.apellido) AS assigned_to_name,
        comp.name AS company_name
      FROM contacts c
      LEFT JOIN users u ON u.id = c.assigned_to
      LEFT JOIN companies comp ON comp.id = c.company_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: {
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1].id : null,
      },
    };
  }

  async findById(id) {
    const result = await query(
      `SELECT c.*, 
        (u.nombre || ' ' || u.apellido) AS assigned_to_name,
        comp.name AS company_name
       FROM contacts c
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN companies comp ON comp.id = c.company_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data, userId) {
    const { company_id, first_name, last_name, email, phone, whatsapp, position, is_primary, assigned_to, tags, notes } = data;
    
    const result = await query(
      `INSERT INTO contacts
         (company_id, first_name, last_name, email, phone, whatsapp, position, is_primary, assigned_to, tags, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [company_id || null, first_name, last_name || null, email || null, phone || null, whatsapp || null,
       position || null, is_primary || false, assigned_to || userId,
       tags || [], notes || null]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['company_id', 'first_name', 'last_name', 'email', 'phone', 'whatsapp', 'position', 'is_primary', 'assigned_to', 'tags', 'notes'];
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
      `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }
}
