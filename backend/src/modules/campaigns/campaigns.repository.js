import { db } from '../../config/database.js';

class CampaignsRepository {
  async findAll({ skip = 0, limit = 50, search = '' }) {
    let query = `SELECT * FROM campaigns`;
    const params = [];
    
    if (search) {
      query += ` WHERE name ILIKE $1 OR description ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, skip);

    const { rows } = await db.query(query, params);
    
    // Count query
    let countQuery = `SELECT COUNT(*) FROM campaigns`;
    const countParams = [];
    if (search) {
      countQuery += ` WHERE name ILIKE $1 OR description ILIKE $1`;
      countParams.push(`%${search}%`);
    }
    const { rows: countRows } = await db.query(countQuery, countParams);
    
    return {
      data: rows,
      total: parseInt(countRows[0].count, 10),
    };
  }

  async findById(id) {
    const { rows } = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
    return rows[0];
  }

  async create(data) {
    const { rows } = await db.query(
      `INSERT INTO campaigns 
        (name, type, status, start_date, end_date, budget, expected_revenue, actual_revenue, actual_cost, description)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        data.name, data.type, data.status, 
        data.start_date || null, data.end_date || null,
        data.budget || 0, data.expected_revenue || 0, data.actual_revenue || 0, data.actual_cost || 0,
        data.description
      ]
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await db.query(
      `UPDATE campaigns 
       SET name = $1, type = $2, status = $3, start_date = $4, end_date = $5, 
           budget = $6, expected_revenue = $7, actual_revenue = $8, actual_cost = $9, description = $10,
           updated_at = NOW()
       WHERE id = $11 
       RETURNING *`,
      [
        data.name, data.type, data.status, 
        data.start_date || null, data.end_date || null,
        data.budget || 0, data.expected_revenue || 0, data.actual_revenue || 0, data.actual_cost || 0,
        data.description, id
      ]
    );
    return rows[0];
  }

  async delete(id) {
    const { rows } = await db.query(
      `DELETE FROM campaigns WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0];
  }
}

export default new CampaignsRepository();
