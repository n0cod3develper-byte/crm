import { db } from '../../config/database.js';

export class ComprasRepository {
  // === CONFIGURACIONES ===
  async getConfig() {
    const res = await db.query('SELECT clave, valor FROM compras_config');
    const config = {};
    for (const row of res.rows) {
      config[row.clave] = row.valor;
    }
    return config;
  }

  // === SOLICITUDES DE COMPRA ===
  async updateEstadoOc(id, nuevoEstado, estadoRequerido) {
    const res = await db.query(
      "UPDATE ordenes_compra SET estado = $1, updated_at = NOW() WHERE id = $2 AND estado = $3 RETURNING id",
      [nuevoEstado, id, estadoRequerido]
    );
    return res.rowCount > 0;
  }
  async isSolicitudExists(consecutivo) {
    const res = await db.query('SELECT id FROM solicitudes_compra WHERE consecutivo = $1', [consecutivo]);
    return res.rowCount > 0;
  }

  async getSolicitudes(filters = {}) {
    let query = `SELECT s.*, (u.nombre || ' ' || u.apellido) as solicitante FROM solicitudes_compra s LEFT JOIN users u ON s.solicitante_id = u.id WHERE 1=1`;
    const params = [];
    
    if (filters.estado) {
      params.push(filters.estado);
      query += ` AND s.estado = $${params.length}`;
    }
    query += ' ORDER BY s.created_at DESC';
    const res = await db.query(query, params);
    return res.rows;
  }

  async getSolicitudById(id) {
    const res = await db.query(`
      SELECT s.*, (u.nombre || ' ' || u.apellido) as solicitante 
      FROM solicitudes_compra s 
      LEFT JOIN users u ON s.solicitante_id = u.id 
      WHERE s.id = $1`, [id]);
    
    if (res.rowCount === 0) return null;
    
    const itemsRes = await db.query('SELECT * FROM solicitud_items WHERE solicitud_id = $1', [id]);
    const cotizaciones = await this.getCotizacionesBySolicitud(id);
    
    return { ...res.rows[0], items: itemsRes.rows, cotizaciones };
  }

  async setSolicitudStatus(id, estado) {
    await db.query('UPDATE solicitudes_compra SET estado = $1, updated_at = NOW() WHERE id = $2', [estado, id]);
  }

  // === COTIZACIONES ===
  async getCotizacionesBySolicitud(solicitud_id) {
    const res = await db.query(`
      SELECT c.*, p.razon_social as proveedor_nombre
      FROM cotizaciones c 
      JOIN proveedores p ON c.proveedor_id = p.id
      WHERE c.solicitud_id = $1
      ORDER BY c.created_at ASC
    `, [solicitud_id]);

    const cotizaciones = res.rows;
    if (cotizaciones.length === 0) return [];

    const ids = cotizaciones.map(c => c.id);
    const itemsRes = await db.query(`
      SELECT ci.* 
      FROM cotizacion_items ci 
      WHERE ci.cotizacion_id = ANY($1)
    `, [ids]);

    const itemsByCotizacion = {};
    for (const item of itemsRes.rows) {
      if (!itemsByCotizacion[item.cotizacion_id]) itemsByCotizacion[item.cotizacion_id] = [];
      itemsByCotizacion[item.cotizacion_id].push(item);
    }

    return cotizaciones.map(c => ({
      ...c,
      items: itemsByCotizacion[c.id] || []
    }));
  }

  // === ÓRDENES DE COMPRA ===
  async isOcExists(consecutivo) {
    const res = await db.query('SELECT id FROM ordenes_compra WHERE consecutivo = $1', [consecutivo]);
    return res.rowCount > 0;
  }

  async getOrdenesCompra(filters = {}) {
    let query = `
      SELECT o.*, p.razon_social as proveedor_nombre 
      FROM ordenes_compra o 
      JOIN proveedores p ON o.proveedor_id = p.id 
      WHERE 1=1
    `;
    const params = [];
    if (filters.estado) {
       params.push(filters.estado);
       query += ` AND o.estado = $${params.length}`;
    }
    if (filters.proveedor_id) {
       params.push(filters.proveedor_id);
       query += ` AND o.proveedor_id = $${params.length}`;
    }
    query += ' ORDER BY o.created_at DESC';
    const res = await db.query(query, params);
    return res.rows;
  }

  async getOrdenCompraById(id) {
    const res = await db.query(`
      SELECT o.*, 
             p.razon_social as proveedor_nombre, 
             p.numero_documento as proveedor_nit, 
             p.email_principal, 
             p.direccion as proveedor_direccion, 
             p.telefono_principal
      FROM ordenes_compra o 
      LEFT JOIN proveedores p ON o.proveedor_id = p.id 
      WHERE o.id = $1
    `, [id]);
    if (res.rowCount === 0) return null;

    const items = await db.query('SELECT * FROM oc_items WHERE orden_compra_id = $1', [id]);
    const aprobaciones = await db.query(`
      SELECT a.*, (u.nombre || ' ' || u.apellido) as aprobador 
      FROM aprobaciones_oc a
      LEFT JOIN users u ON a.aprobador_id = u.id
      WHERE a.entidad_id = $1 AND a.entidad_tipo = 'ORDEN_COMPRA'
      ORDER BY a.nivel ASC
    `, [id]);

    return { ...res.rows[0], items: items.rows, aprobaciones: aprobaciones.rows };
  }

  async getAprobacionesPendientes(userId) {
    // Return orders that are EN_APROBACION and require this user's role/level
    // Simplified: return all EN_APROBACION for now
    const res = await db.query(`
      SELECT o.*, p.razon_social as proveedor_nombre 
      FROM ordenes_compra o
      JOIN proveedores p ON o.proveedor_id = p.id
      WHERE o.estado = 'EN_APROBACION'
      ORDER BY o.created_at DESC
    `);
    return res.rows;
  }
}

export const comprasRepository = new ComprasRepository();
