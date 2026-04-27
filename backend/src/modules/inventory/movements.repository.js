import { query } from '../../config/database.js';

export class MovementsRepository {
  async findAll({ itemId, type, limit = 50 }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (itemId) {
      conditions.push(`item_id = $${i++}`);
      params.push(itemId);
    }
    if (type) {
      conditions.push(`type = $${i++}`);
      params.push(type);
    }

    const sql = `
      SELECT m.*, i.name as item_name, i.codigo_interno
      FROM inventory_movements m
      JOIN inventory_items i ON m.item_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.created_at DESC
      LIMIT $${i}
    `;
    params.push(limit);
    
    const result = await query(sql, params);
    return result.rows;
  }

  async create(data, userId) {
    const { item_id, type, quantity, reference, notes } = data;
    
    // Inicia transacción manual ya que query() es una sola ejecución
    // Pero podemos usar un bloque BEGIN/COMMIT si es necesario.
    // Aquí actualizamos el stock y registramos el movimiento.
    
    const qtyModifier = type === 'in' ? Math.abs(quantity) : -Math.abs(quantity);

    try {
      await query('BEGIN');

      // 1. Registrar el movimiento
      const movementRes = await query(
        `INSERT INTO inventory_movements (item_id, type, quantity, reference, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [item_id, type, quantity, reference, notes, userId]
      );

      // 2. Actualizar stock del item
      await query(
        `UPDATE inventory_items SET stock_current = stock_current + $1, updated_at = NOW() WHERE id = $2`,
        [qtyModifier, item_id]
      );

      await query('COMMIT');
      return movementRes.rows[0];
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  async getStats() {
    const res = await query(`
      SELECT 
        COUNT(*) filter (where type = 'in') as entries,
        COUNT(*) filter (where type = 'out') as exits,
        SUM(quantity) filter (where type = 'in') as total_in,
        SUM(quantity) filter (where type = 'out') as total_out
      FROM inventory_movements
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    return res.rows[0];
  }
}
