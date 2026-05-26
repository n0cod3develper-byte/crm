import { query } from '../../config/database.js';

export class LeadsRepository {
  async findAll({ status, assignedTo, source, campaignId, search, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (status && status !== 'undefined') {
      conditions.push(`l.status = $${i++}`);
      params.push(status);
    }
    if (assignedTo && assignedTo !== 'undefined') {
      conditions.push(`l.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (source && source !== 'undefined') {
      conditions.push(`l.source = $${i++}`);
      params.push(source);
    }
    if (campaignId && campaignId !== 'undefined') {
      conditions.push(`l.campaign_id = $${i++}`);
      params.push(campaignId);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(l.first_name ILIKE $${i} OR l.last_name ILIKE $${i} OR l.email ILIKE $${i} OR l.company_name ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`l.created_at < (SELECT created_at FROM leads WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT l.*,
        u.full_name AS assigned_to_name,
        c.name AS campaign_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      LEFT JOIN campaigns c ON c.id = l.campaign_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.created_at DESC
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
      `SELECT l.*, u.full_name AS assigned_to_name, c.name AS campaign_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN campaigns c ON c.id = l.campaign_id
       WHERE l.id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const { first_name, last_name, email, phone, company_name, source, campaign_id, status, score, assigned_to, notes } = data;
    const result = await query(
      `INSERT INTO leads
        (first_name, last_name, email, phone, company_name, source, campaign_id, status, score, assigned_to, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [first_name, last_name || null, email || null, phone || null, company_name || null,
       source || null, campaign_id || null, status || 'new', score || 0, assigned_to || null, notes || null]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['first_name', 'last_name', 'email', 'phone', 'company_name', 'source', 'campaign_id', 'status', 'score', 'assigned_to', 'notes'];
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
      `UPDATE leads SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async convertToContact(id) {
    // 1. Obtener lead
    const lead = await this.findById(id);
    if (!lead || lead.status === 'converted') return null;

    let companyId = null;

    // 2. Si el lead tiene empresa, crear o buscar la empresa
    if (lead.company_name) {
      const existingCompany = await query(`SELECT id FROM companies WHERE name ILIKE $1 LIMIT 1`, [lead.company_name]);
      if (existingCompany.rows.length > 0) {
        companyId = existingCompany.rows[0].id;
      } else {
        const newCompany = await query(
          `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
          [lead.company_name]
        );
        companyId = newCompany.rows[0].id;
      }
    }

    // 3. Crear el contacto
    const newContact = await query(
      `INSERT INTO contacts (first_name, last_name, email, phone, company_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [lead.first_name, lead.last_name, lead.email, lead.phone, companyId]
    );
    const contactId = newContact.rows[0].id;

    // 4. Actualizar el Lead a 'converted'
    const updatedLead = await query(
      `UPDATE leads SET status = 'converted', converted_contact_id = $1, converted_at = NOW() WHERE id = $2 RETURNING *`,
      [contactId, id]
    );

    return { lead: updatedLead.rows[0], contact: newContact.rows[0] };
  }

  async delete(id) {
    const result = await query(`DELETE FROM leads WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}

