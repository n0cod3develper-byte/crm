import { query } from '../../config/database.js';

export class OpportunitiesRepository {
  async findAll({ stageId, companyId, assignedTo, search, limit = 50, cursor }) {
    const conditions = ['o.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (stageId && stageId !== 'undefined') {
      conditions.push(`o.stage_id = $${i++}`);
      params.push(stageId);
    }
    if (companyId && companyId !== 'undefined') {
      conditions.push(`o.company_id = $${i++}`);
      params.push(companyId);
    }
    if (assignedTo && assignedTo !== 'undefined') {
      conditions.push(`o.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (search && search.trim() !== '') {
      conditions.push(`o.title ILIKE $${i++}`);
      params.push(`%${search.trim()}%`);
    }
    if (cursor) {
      conditions.push(`o.created_at < (SELECT created_at FROM opportunities WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT o.*,
        s.name  AS stage_name,
        s.color AS stage_color,
        s.is_closed_won,
        s.is_closed_lost,
        comp.name AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name,'') AS contact_name,
        u.full_name AS assigned_to_name
      FROM opportunities o
      LEFT JOIN pipeline_stages s  ON s.id  = o.stage_id
      LEFT JOIN companies comp     ON comp.id = o.company_id
      LEFT JOIN contacts ct        ON ct.id = o.contact_id
      LEFT JOIN users u            ON u.id  = o.assigned_to
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.created_at DESC
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
      `SELECT o.*,
        s.name AS stage_name, s.color AS stage_color,
        s.is_closed_won, s.is_closed_lost,
        comp.name AS company_name,
        ct.first_name || ' ' || COALESCE(ct.last_name,'') AS contact_name,
        u.full_name AS assigned_to_name
      FROM opportunities o
      LEFT JOIN pipeline_stages s  ON s.id  = o.stage_id
      LEFT JOIN companies comp     ON comp.id = o.company_id
      LEFT JOIN contacts ct        ON ct.id = o.contact_id
      LEFT JOIN users u            ON u.id  = o.assigned_to
      WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data, userId) {
    const { title, company_id, contact_id, stage_id, value, currency, expected_close, probability, source, notes, tags } = data;
    const result = await query(
      `INSERT INTO opportunities
        (title, company_id, contact_id, stage_id, assigned_to, value, currency, expected_close, probability, source, notes, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [title, company_id || null, contact_id || null, stage_id, userId,
       value || 0, currency || 'COP', expected_close || null, probability || 0,
       source || null, notes || null, tags || []]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['title','company_id','contact_id','stage_id','assigned_to','value',
      'currency','expected_close','probability','source','lost_reason','won_at','notes','tags'];
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
      `UPDATE opportunities SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async moveStage(id, stageId, fromStageId) {
    await query(
      `INSERT INTO opportunity_stage_history (opportunity_id, from_stage_id, to_stage_id) VALUES ($1,$2,$3)`,
      [id, fromStageId, stageId]
    );
    return this.update(id, { stage_id: stageId });
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE opportunities SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async summary() {
    const result = await query(`
      SELECT s.id, s.name, s.color, s.order_index,
        COUNT(o.id)::int AS count,
        COALESCE(SUM(o.value),0)::numeric AS total_value
      FROM pipeline_stages s
      LEFT JOIN opportunities o ON o.stage_id = s.id AND o.deleted_at IS NULL
      GROUP BY s.id, s.name, s.color, s.order_index
      ORDER BY s.order_index
    `);
    return result.rows;
  }
}

