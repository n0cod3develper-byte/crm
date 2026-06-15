import { query, withTransaction } from '../../config/database.js';

export class BudgetRepository {
  // ── Áreas ──────────────────────────────────────────────
  async getAreas() {
    const sql = `SELECT * FROM budget_areas ORDER BY id ASC`;
    const result = await query(sql);
    return result.rows;
  }

  async createArea(data) {
    const sql = `INSERT INTO budget_areas (name, description, is_active) VALUES ($1, $2, $3) RETURNING *`;
    const result = await query(sql, [data.name, data.description, data.is_active ?? true]);
    return result.rows[0];
  }

  // ── Presupuesto Anual ──────────────────────────────────
  async getAnnualBudget(areaId, year) {
    const sql = `SELECT * FROM budget_annual WHERE area_id = $1 AND year = $2`;
    const result = await query(sql, [areaId, year]);
    return result.rows[0] || null;
  }

  async upsertAnnualBudget(data) {
    const sql = `
      INSERT INTO budget_annual (area_id, year, total_amount, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (area_id, year) 
      DO UPDATE SET total_amount = EXCLUDED.total_amount, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await query(sql, [data.area_id, data.year, data.total_amount]);
    return result.rows[0];
  }

  // ── Presupuesto por Equipo ─────────────────────────────
  async getEquipmentBudgets(budgetAnnualId) {
    const sql = `
      SELECT be.*, e.marca, e.modelo, e.serie 
      FROM budget_equipment be
      JOIN equipos e ON e.id = be.equipment_id
      WHERE be.budget_annual_id = $1
      ORDER BY be.created_at ASC
    `;
    const result = await query(sql, [budgetAnnualId]);
    return result.rows;
  }

  async upsertEquipmentBudget(data) {
    return await withTransaction(async (client) => {
      // 1. Validar que el acumulado no exceda el presupuesto anual
      const annualRes = await client.query(`SELECT total_amount FROM budget_annual WHERE id = $1`, [data.budget_annual_id]);
      const annualBudget = annualRes.rows[0];
      if (!annualBudget) {
        throw new Error('El presupuesto anual correspondiente no existe');
      }

      // Sumar detalles mensuales de otros equipos
      const currentOthersRes = await client.query(`
        SELECT COALESCE(SUM(bmd.amount), 0) as total
        FROM budget_monthly_detail bmd
        JOIN budget_equipment be ON be.id = bmd.budget_equipment_id
        WHERE be.budget_annual_id = $1 AND be.equipment_id != $2
      `, [data.budget_annual_id, data.equipment_id]);
      const othersTotal = parseFloat(currentOthersRes.rows[0]?.total || 0);

      // Sumar nuevos detalles para este equipo
      const newEquipmentTotal = data.monthly_details 
        ? data.monthly_details.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) 
        : 0;

      if (othersTotal + newEquipmentTotal > parseFloat(annualBudget.total_amount)) {
        throw new Error('El presupuesto acumulado de los equipos supera el límite anual asignado a esta área');
      }

      // 2. Upsert budget_equipment
      const eqSql = `
        INSERT INTO budget_equipment (budget_annual_id, equipment_id, location, working_days, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (budget_annual_id, equipment_id) 
        DO UPDATE SET location = EXCLUDED.location, working_days = EXCLUDED.working_days, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const eqRes = await client.query(eqSql, [
        data.budget_annual_id, 
        data.equipment_id, 
        data.location, 
        data.working_days
      ]);
      const eqRecord = eqRes.rows[0];

      // 3. Upsert monthly details if provided
      if (data.monthly_details && Array.isArray(data.monthly_details)) {
        for (const detail of data.monthly_details) {
          const workingDaysVal = parseInt(detail.working_days) || 0;
          if (workingDaysVal !== 0 && (workingDaysVal < 1 || workingDaysVal > 31)) {
            throw new Error('Los días hábiles por mes deben estar entre 1 y 31');
          }

          const detailSql = `
            INSERT INTO budget_monthly_detail (budget_equipment_id, month, amount, working_days)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (budget_equipment_id, month) 
            DO UPDATE SET amount = EXCLUDED.amount, working_days = EXCLUDED.working_days
          `;
          await client.query(detailSql, [
            eqRecord.id,
            detail.month,
            detail.amount,
            detail.working_days
          ]);
        }
      }

      return eqRecord;
    });
  }

  async deleteEquipmentBudget(id) {
    const sql = `DELETE FROM budget_equipment WHERE id = $1 RETURNING id`;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // ── Detalle Mensual ────────────────────────────────────
  async getEquipmentMonthlyDetails(budgetEquipmentId) {
    const sql = `SELECT * FROM budget_monthly_detail WHERE budget_equipment_id = $1 ORDER BY month ASC`;
    const result = await query(sql, [budgetEquipmentId]);
    return result.rows;
  }
}

export const budgetRepository = new BudgetRepository();
