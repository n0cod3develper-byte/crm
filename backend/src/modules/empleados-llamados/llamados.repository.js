import { query } from '../../config/database.js';

export class LlamadosRepository {
  async findByEmpleado(empleadoId) {
    const sql = `
      SELECT el.*, u.nombre AS registrado_por_nombre
      FROM empleados_llamados el
      LEFT JOIN users u ON u.id = el.registrado_por
      WHERE el.empleado_id = $1
      ORDER BY el.fecha DESC, el.created_at DESC
    `;
    const result = await query(sql, [empleadoId]);
    return result.rows;
  }

  async findById(id) {
    const sql = `
      SELECT el.*, u.nombre AS registrado_por_nombre, e.full_name AS empleado_nombre
      FROM empleados_llamados el
      LEFT JOIN users u ON u.id = el.registrado_por
      JOIN employees e ON e.id = el.empleado_id
      WHERE el.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async create(data) {
    const sql = `
      INSERT INTO empleados_llamados
        (empleado_id, tipo, gravedad, fecha, descripcion, observaciones, registrado_por, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await query(sql, [
      data.empleado_id,
      data.tipo,
      data.gravedad || null,
      data.fecha || new Date().toISOString().split('T')[0],
      data.descripcion,
      data.observaciones || null,
      data.registrado_por || null,
      data.estado || 'CERRADO'
    ]);
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['gravedad', 'descripcion', 'observaciones', 'estado', 'fecha_descargos', 'respuesta_empleado'];

    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `UPDATE empleados_llamados SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async remove(id) {
    const sql = `DELETE FROM empleados_llamados WHERE id = $1 RETURNING id`;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }
}

export const llamadosRepository = new LlamadosRepository();
