import { query } from '../../config/database.js';

export class PipelineRepository {
  async findAllStages() {
    const result = await query(`SELECT * FROM pipeline_stages ORDER BY order_index ASC`);
    return result.rows;
  }

  async findStageById(id) {
    const result = await query(`SELECT * FROM pipeline_stages WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async createStage(data) {
    const { name, order_index, color, probability, is_closed_won, is_closed_lost } = data;
    const result = await query(
      `INSERT INTO pipeline_stages (name, order_index, color, probability, is_closed_won, is_closed_lost)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, order_index, color || '#6366f1', probability || 0, is_closed_won || false, is_closed_lost || false]
    );
    return result.rows[0];
  }

  async updateStage(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['name', 'order_index', 'color', 'probability', 'is_closed_won', 'is_closed_lost'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findStageById(id);
    values.push(id);
    const result = await query(
      `UPDATE pipeline_stages SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }
}
