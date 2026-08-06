import { query } from '../../config/database.js';

export class SaludRepository {
  async getExamenes(empleadoId) {
    const sql = `SELECT e.*, u.nombre AS registrado_por_nombre FROM empleados_examenes e LEFT JOIN users u ON u.id = e.registrado_por WHERE e.empleado_id = $1 ORDER BY e.fecha DESC`;
    return (await query(sql, [empleadoId])).rows;
  }
  async createExamen(d) {
    const sql = `INSERT INTO empleados_examenes (empleado_id, tipo, fecha, resultado, observaciones, archivo_adjunto, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
    return (await query(sql, [d.empleado_id, d.tipo, d.fecha || new Date().toISOString().split('T')[0], d.resultado, d.observaciones || null, d.archivo_adjunto || null, d.registrado_por])).rows[0];
  }
  async deleteExamen(id) { return (await query(`DELETE FROM empleados_examenes WHERE id=$1 RETURNING id`, [id])).rows[0]; }

  async getRestricciones(empleadoId) {
    const sql = `SELECT r.*, u.nombre AS registrado_por_nombre FROM empleados_restricciones r LEFT JOIN users u ON u.id = r.registrado_por WHERE r.empleado_id = $1 ORDER BY r.fecha_inicio DESC`;
    return (await query(sql, [empleadoId])).rows;
  }
  async createRestriccion(d) {
    const sql = `INSERT INTO empleados_restricciones (empleado_id, descripcion, fecha_inicio, fecha_fin, activa, registrado_por) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
    return (await query(sql, [d.empleado_id, d.descripcion, d.fecha_inicio || new Date().toISOString().split('T')[0], d.fecha_fin || null, d.activa !== false, d.registrado_por])).rows[0];
  }
  async updateRestriccion(id, d) {
    const sql = `UPDATE empleados_restricciones SET activa=$1, fecha_fin=$2 WHERE id=$3 RETURNING *`;
    return (await query(sql, [d.activa, d.fecha_fin || null, id])).rows[0];
  }
  async deleteRestriccion(id) { return (await query(`DELETE FROM empleados_restricciones WHERE id=$1 RETURNING id`, [id])).rows[0]; }

  async getEPP(empleadoId) {
    const sql = `SELECT e.*, u.nombre AS registrado_por_nombre FROM empleados_epp e LEFT JOIN users u ON u.id = e.registrado_por WHERE e.empleado_id = $1 ORDER BY e.fecha_entrega DESC`;
    return (await query(sql, [empleadoId])).rows;
  }
  async createEPP(d) {
    const sql = `INSERT INTO empleados_epp (empleado_id, elemento, fecha_entrega, observaciones, registrado_por) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
    return (await query(sql, [d.empleado_id, d.elemento, d.fecha_entrega || new Date().toISOString().split('T')[0], d.observaciones || null, d.registrado_por])).rows[0];
  }
  async deleteEPP(id) { return (await query(`DELETE FROM empleados_epp WHERE id=$1 RETURNING id`, [id])).rows[0]; }

  async getAccidentes(empleadoId) {
    const sql = `SELECT a.*, u.nombre AS registrado_por_nombre FROM empleados_accidentes a LEFT JOIN users u ON u.id = a.registrado_por WHERE a.empleado_id = $1 ORDER BY a.fecha DESC`;
    return (await query(sql, [empleadoId])).rows;
  }
  async createAccidente(d) {
    const sql = `INSERT INTO empleados_accidentes (empleado_id, fecha, tipo, descripcion, genero_incapacidad, dias_incapacidad, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
    return (await query(sql, [d.empleado_id, d.fecha || new Date().toISOString().split('T')[0], d.tipo, d.descripcion, d.genero_incapacidad || false, d.dias_incapacidad || null, d.registrado_por])).rows[0];
  }
  async deleteAccidente(id) { return (await query(`DELETE FROM empleados_accidentes WHERE id=$1 RETURNING id`, [id])).rows[0]; }
}
export const saludRepository = new SaludRepository();
