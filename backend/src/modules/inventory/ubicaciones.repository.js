import { query } from '../../config/database.js';

export class UbicacionesRepository {
  async findAll({ search, activo }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (activo !== undefined) {
      conditions.push(`activo = $${i++}`);
      params.push(activo === 'true');
    }

    if (search) {
      conditions.push(`(bodega ILIKE $${i} OR zona ILIKE $${i} OR codigo_ubicacion ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    const sql = `
      SELECT u.*, 
             (SELECT count(*) FROM inventory_items i WHERE i.ubicacion_id = u.id) as total_items
      FROM ubicaciones_bodega u
      WHERE ${conditions.join(' AND ')}
      ORDER BY bodega, zona, estante, nivel, posicion
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async findById(id) {
    const result = await query(`SELECT * FROM ubicaciones_bodega WHERE id = $1`, [id]);
    return result.rows[0];
  }

  async create(data) {
    const { bodega, zona, estante, nivel, posicion, descripcion, codigo_qr, activo } = data;
    const result = await query(
      `INSERT INTO ubicaciones_bodega 
        (bodega, zona, estante, nivel, posicion, descripcion, codigo_qr, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [bodega || 'Principal', zona, estante, nivel, posicion, descripcion, codigo_qr, activo ?? true]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['bodega', 'zona', 'estante', 'nivel', 'posicion', 'descripcion', 'codigo_qr', 'activo'];
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
    // Check if there are items assigned to this location
    const check = await query(`SELECT count(*) FROM inventory_items WHERE ubicacion_id = $1`, [id]);
    if (parseInt(check.rows[0].count) > 0) {
      throw new Error('No se puede eliminar una ubicación con productos asignados');
    }
    
    const result = await query(`DELETE FROM ubicaciones_bodega WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0];
  }

  async getStats() {
    const sinUbicacion = await query(`SELECT count(*) FROM inventory_items WHERE tipo = 'PRODUCTO' AND (ubicacion_id IS NULL)`);
    const ubicacionesVacias = await query(`SELECT count(*) FROM ubicaciones_bodega WHERE id NOT IN (SELECT DISTINCT ubicacion_id FROM inventory_items WHERE ubicacion_id IS NOT NULL)`);
    const porZona = await query(`SELECT zona, count(*) as total FROM ubicaciones_bodega GROUP BY zona`);
    const topUbicaciones = await query(`
      SELECT u.codigo_ubicacion, count(i.id) as total_items
      FROM ubicaciones_bodega u
      LEFT JOIN inventory_items i ON u.id = i.ubicacion_id
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
}

export const ubicacionesRepository = new UbicacionesRepository();
