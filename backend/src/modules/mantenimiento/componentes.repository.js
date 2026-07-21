import { query } from '../../config/database.js';

class ComponentesRepository {
  async getAllActive() {
    const sql = `
      SELECT id, nombre, descripcion, is_active
      FROM mantenimiento_componentes
      WHERE is_active = true
      ORDER BY nombre ASC
    `;
    const res = await query(sql);
    return res.rows;
  }

  async getAll() {
    const sql = `
      SELECT id, nombre, descripcion, is_active
      FROM mantenimiento_componentes
      ORDER BY nombre ASC
    `;
    const res = await query(sql);
    return res.rows;
  }

  async create(data) {
    const sql = `
      INSERT INTO mantenimiento_componentes (nombre, descripcion, is_active)
      VALUES ($1, $2, $3)
      RETURNING id, nombre, descripcion, is_active
    `;
    const res = await query(sql, [data.nombre, data.descripcion, data.is_active ?? true]);
    return res.rows[0];
  }

  async update(id, data) {
    const sql = `
      UPDATE mantenimiento_componentes
      SET nombre = $1, descripcion = $2, is_active = $3
      WHERE id = $4
      RETURNING id, nombre, descripcion, is_active
    `;
    const res = await query(sql, [data.nombre, data.descripcion, data.is_active, id]);
    return res.rows[0];
  }
}

export const componentesRepository = new ComponentesRepository();
