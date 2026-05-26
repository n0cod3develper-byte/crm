import { query } from '../../config/database.js';

export class UbicacionesRepository {
  async findAll({ search, activo }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (activo !== undefined) {
      conditions.push(`u.activo = $${i++}`);
      params.push(activo === 'true');
    }

    if (search) {
      conditions.push(`(u.codigo_ubicacion ILIKE $${i} OR p.codigo ILIKE $${i} OR u.descripcion ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    const sql = `
      SELECT u.*, 
             p.codigo as prefijo_codigo, p.descripcion as prefijo_desc,
             n.codigo as nivel_codigo, n.descripcion as nivel_desc,
             (SELECT count(*) FROM inventario i WHERE i.ubicacion_id = u.id) as total_items
      FROM ubicaciones_bodega u
      LEFT JOIN ubicacion_prefijos p ON u.prefijo_id = p.id
      LEFT JOIN ubicacion_niveles n ON u.nivel_id = n.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.codigo, n.codigo, u.orientacion, u.nueva_posicion
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async findById(id) {
    const result = await query(`
      SELECT u.*, p.codigo as prefijo_codigo, n.codigo as nivel_codigo
      FROM ubicaciones_bodega u
      LEFT JOIN ubicacion_prefijos p ON u.prefijo_id = p.id
      LEFT JOIN ubicacion_niveles n ON u.nivel_id = n.id
      WHERE u.id = $1
    `, [id]);
    return result.rows[0];
  }

  async create(data) {
    const { prefijo_id, nivel_id, orientacion, nueva_posicion, descripcion, activo } = data;
    const result = await query(
      `INSERT INTO ubicaciones_bodega 
        (prefijo_id, nivel_id, orientacion, nueva_posicion, descripcion, activo)
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [prefijo_id, nivel_id, orientacion, nueva_posicion, descripcion, activo ?? true]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['prefijo_id', 'nivel_id', 'orientacion', 'nueva_posicion', 'descripcion', 'activo'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE ubicaciones_bodega SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id) {
    const check = await query(`SELECT count(*) FROM inventario WHERE ubicacion_id = $1`, [id]);
    if (parseInt(check.rows[0].count) > 0) {
      throw new Error('No se puede eliminar una ubicación con productos asignados');
    }
    
    const result = await query(`DELETE FROM ubicaciones_bodega WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0];
  }

  async getStats() {
    const sinUbicacion = await query(`
      SELECT count(*) FROM inventario 
      WHERE tipo = 'PRODUCTO' AND (ubicacion_id IS NULL OR ubicacion_id IN (
        SELECT u.id FROM ubicaciones_bodega u 
        JOIN ubicacion_prefijos p ON u.prefijo_id = p.id 
        WHERE p.codigo = 'SIN'
      ))
    `);
    const ubicacionesVacias = await query(`SELECT count(*) FROM ubicaciones_bodega WHERE id NOT IN (SELECT DISTINCT ubicacion_id FROM inventario WHERE ubicacion_id IS NOT NULL)`);
    const porZona = await query(`
      SELECT p.descripcion as zona, count(u.id) as total 
      FROM ubicaciones_bodega u
      JOIN ubicacion_prefijos p ON u.prefijo_id = p.id
      GROUP BY p.descripcion
    `);
    const topUbicaciones = await query(`
      SELECT u.codigo_ubicacion, count(i.id) as total_items
      FROM ubicaciones_bodega u
      LEFT JOIN inventario i ON u.id = i.ubicacion_id
      GROUP BY u.id, u.codigo_ubicacion
      HAVING count(i.id) > 0
      ORDER BY total_items DESC
      LIMIT 5
    `);

    return {
      sin_ubicacion: parseInt(sinUbicacion.rows[0].count),
      ubicaciones_vacias: parseInt(ubicacionesVacias.rows[0].count),
      por_zona: porZona.rows,
      top_ubicaciones: topUbicaciones.rows
    };
  }

  // ─── Prefijos ────────────────────────────────────────────────
  async getPrefijos() {
    const res = await query('SELECT * FROM ubicacion_prefijos ORDER BY codigo');
    return res.rows;
  }

  async createPrefijo({ codigo, descripcion }) {
    const res = await query(
      `INSERT INTO ubicacion_prefijos (codigo, descripcion) VALUES ($1, $2) RETURNING *`,
      [codigo.toUpperCase().trim(), descripcion.trim()]
    );
    return res.rows[0];
  }

  async updatePrefijo(id, { codigo, descripcion, activo }) {
    const fields = [];
    const params = [];
    let i = 1;
    if (codigo !== undefined) { fields.push(`codigo = $${i++}`); params.push(codigo.toUpperCase().trim()); }
    if (descripcion !== undefined) { fields.push(`descripcion = $${i++}`); params.push(descripcion.trim()); }
    if (activo !== undefined) { fields.push(`activo = $${i++}`); params.push(activo); }
    if (!fields.length) return this.getPrefijos();
    params.push(id);
    const res = await query(
      `UPDATE ubicacion_prefijos SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return res.rows[0];
  }

  async deletePrefijo(id) {
    const check = await query(`SELECT count(*) FROM ubicaciones_bodega WHERE prefijo_id = $1`, [id]);
    if (parseInt(check.rows[0].count) > 0) {
      throw new Error('No se puede eliminar: hay ubicaciones asociadas a este prefijo');
    }
    await query(`DELETE FROM ubicacion_prefijos WHERE id = $1`, [id]);
    return { deleted: true };
  }

  // ─── Niveles ─────────────────────────────────────────────────
  async getNiveles() {
    const res = await query('SELECT * FROM ubicacion_niveles ORDER BY codigo');
    return res.rows;
  }

  async createNivel({ codigo, descripcion }) {
    const res = await query(
      `INSERT INTO ubicacion_niveles (codigo, descripcion) VALUES ($1, $2) RETURNING *`,
      [codigo.toUpperCase().trim(), descripcion.trim()]
    );
    return res.rows[0];
  }

  async updateNivel(id, { codigo, descripcion, activo }) {
    const fields = [];
    const params = [];
    let i = 1;
    if (codigo !== undefined) { fields.push(`codigo = $${i++}`); params.push(codigo.toUpperCase().trim()); }
    if (descripcion !== undefined) { fields.push(`descripcion = $${i++}`); params.push(descripcion.trim()); }
    if (activo !== undefined) { fields.push(`activo = $${i++}`); params.push(activo); }
    if (!fields.length) return this.getNiveles();
    params.push(id);
    const res = await query(
      `UPDATE ubicacion_niveles SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return res.rows[0];
  }

  async deleteNivel(id) {
    const check = await query(`SELECT count(*) FROM ubicaciones_bodega WHERE nivel_id = $1`, [id]);
    if (parseInt(check.rows[0].count) > 0) {
      throw new Error('No se puede eliminar: hay ubicaciones asociadas a este nivel');
    }
    await query(`DELETE FROM ubicacion_niveles WHERE id = $1`, [id]);
    return { deleted: true };
  }
}

export const ubicacionesRepository = new UbicacionesRepository();
