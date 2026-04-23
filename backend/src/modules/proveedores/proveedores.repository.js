import { db } from '../../config/database.js';

export class ProveedoresRepository {
  async findAll({ tipo, estado, condicion_pago, search, limit = 50, offset = 0 }) {
    let query = `
      SELECT p.*,
        (SELECT json_agg(json_build_object('categoria', c.categoria, 'descripcion', c.descripcion))
         FROM proveedor_categorias_productos c WHERE c.proveedor_id = p.id) as categorias
      FROM proveedores p
      WHERE p.deleted_at IS NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (tipo) {
      query += ` AND $${paramIndex} = ANY(p.tipo_proveedor)`;
      params.push(tipo);
      paramIndex++;
    }
    if (estado) {
      query += ` AND p.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }
    if (condicion_pago) {
      query += ` AND p.condicion_pago = $${paramIndex}`;
      params.push(condicion_pago);
      paramIndex++;
    }
    if (search) {
      query += ` AND (
        p.razon_social ILIKE $${paramIndex} OR 
        p.numero_documento ILIKE $${paramIndex} OR
        p.nombre_comercial ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.razon_social ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Contar total
    let countQuery = `SELECT COUNT(*) FROM proveedores p WHERE p.deleted_at IS NULL`;
    const countParams = [];
    if (tipo || estado || condicion_pago || search) {
       // simplificado para contar
       countQuery = `SELECT COUNT(*) FROM (${query.split('ORDER BY')[0]}) as c`;
    }
    
    const countResult = await db.query(countQuery, tipo || estado || condicion_pago || search ? params.slice(0, paramIndex - 1) : []);

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset
    };
  }

  async findById(id) {
    const query = `
      SELECT p.*,
        (SELECT json_agg(json_build_object('categoria', c.categoria, 'descripcion', c.descripcion))
         FROM proveedor_categorias_productos c WHERE c.proveedor_id = p.id) as categorias,
        (SELECT COUNT(*) FROM ordenes_compra oc WHERE oc.proveedor_id = p.id AND oc.estado != 'ANULADA') as conteo_oc
      FROM proveedores p
      WHERE p.id = $1 AND p.deleted_at IS NULL
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  async checkDocumentoExists(numero_documento, excludeId = null) {
    let query = 'SELECT id FROM proveedores WHERE numero_documento = $1 AND deleted_at IS NULL';
    const params = [numero_documento];
    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await db.query(query, params);
    return result.rowCount > 0;
  }

  async create(data, userId) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const categorias = data.categorias;
      delete data.categorias;

      const fields = Object.keys(data);
      const values = Object.values(data).map(v => v === undefined ? null : v);
      
      fields.push('created_by');
      values.push(userId);

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO proveedores (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      const proveedor = result.rows[0];

      if (categorias && categorias.length > 0) {
        for (const cat of categorias) {
          await client.query(
            `INSERT INTO proveedor_categorias_productos (proveedor_id, categoria, descripcion) VALUES ($1, $2, $3)`,
            [proveedor.id, cat.categoria, cat.descripcion]
          );
        }
      }

      await client.query('COMMIT');
      return proveedor;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id, data) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const categorias = data.categorias;
      delete data.categorias;

      if (Object.keys(data).length > 0) {
        const fields = Object.keys(data);
        const values = Object.values(data).map(v => v === undefined ? null : v);
        
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        values.push(id);
        
        const updateQuery = `
          UPDATE proveedores 
          SET ${setClause}, updated_at = NOW() 
          WHERE id = $${values.length} AND deleted_at IS NULL
          RETURNING id
        `;
        
        const updateRes = await client.query(updateQuery, values);
        if (updateRes.rowCount === 0) {
          throw new Error('Proveedor no encontrado o ya ha sido eliminado');
        }
      }

      if (categorias !== undefined) {
        await client.query('DELETE FROM proveedor_categorias_productos WHERE proveedor_id = $1', [id]);
        if (Array.isArray(categorias)) {
          for (const cat of categorias) {
            await client.query(
              `INSERT INTO proveedor_categorias_productos (proveedor_id, categoria, descripcion) VALUES ($1, $2, $3)`,
              [id, cat.categoria, cat.descripcion]
            );
          }
        }
      }

      await client.query('COMMIT');
      
      // Obtener el registro actualizado fuera de la transacción para mayor seguridad
      return await this.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id) {
    // Check pending OCs
    const pendingQuery = `
      SELECT id FROM ordenes_compra 
      WHERE proveedor_id = $1 AND estado IN ('BORRADOR', 'EN_APROBACION', 'APROBADA', 'EMITIDA', 'RECIBIDA_PARCIAL')
    `;
    const pendingResult = await db.query(pendingQuery, [id]);
    if (pendingResult.rowCount > 0) {
      throw new Error('El proveedor tiene órdenes de compra activas o pendientes de proceso.');
    }

    const query = `
      UPDATE proveedores 
      SET deleted_at = NOW(), estado = 'INACTIVO'
      WHERE id = $1 
      RETURNING id
    `;
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  async rate(id, calificacion) {
    // Basic calificacion logic for mock testing
    // To properly calculate avg, we could store history in a proveedor_calificaciones table
    // For now we store the last one or average directly on the field
    const query = `
      UPDATE proveedores
      SET calificacion = $2
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id, calificacion]);
    return result.rows[0];
  }
}

export const proveedoresRepository = new ProveedoresRepository();
