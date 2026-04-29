import { query } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';

export class CompaniesRepository {
  async findAll({ search, assignedTo, tags, limit = 20, cursor }) {
    const conditions = ['c.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (search) {
      conditions.push(`(c.name ILIKE $${i} OR c.nit ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (assignedTo) {
      conditions.push(`c.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (tags?.length) {
      conditions.push(`c.tags && $${i++}`);
      params.push(tags);
    }

    const countSql = `SELECT COUNT(*)::INT AS total FROM companies c WHERE ${conditions.join(' AND ')}`;
    const countResult = await query(countSql, params);
    const totalCount = countResult.rows[0].total;

    if (cursor) {
      conditions.push(`c.id < $${i++}`);
      params.push(cursor);
    }

    params.push(limit + 1);  // +1 para detectar si hay más páginas

    const sql = `
      SELECT c.*,
        u.full_name AS assigned_to_name,
        COUNT(DISTINCT ct.id)::INT AS contacts_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage_id NOT IN (
          SELECT id FROM pipeline_stages WHERE is_closed_won OR is_closed_lost
        ))::INT AS open_opportunities_count,
        (SELECT COUNT(*)::INT FROM equipos e WHERE e.empresa_id = c.id AND e.deleted_at IS NULL) AS equipment_count
      FROM companies c
      LEFT JOIN users u ON u.id = c.assigned_to
      LEFT JOIN contacts ct ON ct.company_id = c.id AND ct.deleted_at IS NULL
      LEFT JOIN opportunities o ON o.company_id = c.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, u.full_name
      ORDER BY c.id DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: {
        totalCount,
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1].id : null,
      },
    };
  }

  async findById(id) {
    const result = await query(
      `SELECT c.*, u.full_name AS assigned_to_name
       FROM companies c
       LEFT JOIN users u ON u.id = c.assigned_to
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data, userId) {
    const { name, nit, industry, website, phone, phone_2, department, address, city, country, tags, notes, assigned_to } = data;
    const result = await query(
      `INSERT INTO companies
         (name, nit, industry, website, phone, phone_2, department, address, city, country, tags, notes, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [name, nit || null, industry || 'logistics', website || null, phone || null, phone_2 || null, department || null,
       address || null, city || null, country || 'Colombia',
       tags || [], notes || null, assigned_to || userId]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['name','nit','industry','website','phone','phone_2','department','address','city','country','tags','notes','assigned_to'];
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
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE companies SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async bulkCreate(dataArray, userId) {
    if (!dataArray || dataArray.length === 0) return [];
    
    const BATCH_SIZE = 100;
    const insertedRows = [];

    for (let batchStart = 0; batchStart < dataArray.length; batchStart += BATCH_SIZE) {
      const batch = dataArray.slice(batchStart, batchStart + BATCH_SIZE);
      const values = [];
      const placeholders = [];
      let i = 1;

      for (const data of batch) {
        const { name, nit, industry, website, phone, phone_2, department, address, city, country, tags, notes, assigned_to } = data;
        placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
        values.push(
          name,
          nit || null,
          industry || 'logistics',
          website || null,
          phone || null,
          phone_2 || null,
          department || null,
          address || null,
          city || null,
          country || 'Colombia',
          tags || [],
          notes || null,
          assigned_to || userId || null
        );
      }

      const queryStr = `
        INSERT INTO companies (name, nit, industry, website, phone, phone_2, department, address, city, country, tags, notes, assigned_to)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (nit) DO NOTHING
        RETURNING *
      `;

      const result = await query(queryStr, values);
      insertedRows.push(...result.rows);
    }
    return insertedRows;
  }

  async getTimeline(companyId, limit = 30) {
    const result = await query(
      `SELECT
        'communication' AS item_type,
        c.id, c.type, c.subject, c.body, c.direction, c.occurred_at AS date,
        u.full_name AS created_by_name
       FROM communications c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.company_id = $1
       UNION ALL
       SELECT
        'task' AS item_type,
        t.id, t.type, t.title AS subject, t.description AS body,
        NULL AS direction, t.created_at AS date,
        u.full_name AS created_by_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.related_type = 'company' AND t.related_id = $1
       ORDER BY date DESC
       LIMIT $2`,
      [companyId, limit]
    );
    return result.rows;
  }
}
