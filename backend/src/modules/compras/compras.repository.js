import { db, query } from '../../config/database.js';

export class ComprasRepository {
  /**
   * Búsqueda en tiempo real de repuestos y productos en catálogo/inventario
   * Busca por nombre comercial, nombre interno, código interno, referencia de fabricante o SKU.
   */
  async buscarProductos(q = '', limit = 20) {
    const term = `%${q.trim()}%`;
    const sql = `
      SELECT 
        i.id,
        COALESCE(i.codigo_interno, i.sku, 'S/C') AS codigo_interno,
        COALESCE(i.nombre_comercial, i.name) AS nombre,
        i.referencia_fabricante,
        i.marca,
        COALESCE(i.stock_actual, 0) AS stock_actual,
        COALESCE(u.abreviatura, i.unit, 'UND') AS unidad_medida,
        c.nombre AS categoria_nombre,
        i.costo_reposicion,
        i.costo_promedio_ponderado
      FROM inventario i
      LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
      LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
      WHERE i.is_active = true
        AND (
          i.codigo_interno ILIKE $1 
          OR i.name ILIKE $1 
          OR i.nombre_comercial ILIKE $1 
          OR i.referencia_fabricante ILIKE $1 
          OR i.sku ILIKE $1
          OR i.marca ILIKE $1
        )
      ORDER BY 
        CASE 
          WHEN i.codigo_interno ILIKE $1 THEN 1 
          WHEN i.nombre_comercial ILIKE $1 THEN 2
          ELSE 3
        END,
        COALESCE(i.nombre_comercial, i.name) ASC
      LIMIT $2;
    `;
    const result = await query(sql, [term, limit]);
    return result.rows;
  }

  /**
   * Obtiene la información en vivo de stock y el último precio de compra para un producto dado.
   * Regla de negocio: Último precio determinado por fecha_compra DESC, created_at DESC.
   */
  async getProductoInfoCompra(productoId) {
    // 1. Datos actuales del producto en inventario
    const prodSql = `
      SELECT 
        i.id,
        COALESCE(i.codigo_interno, i.sku, 'S/C') AS codigo_interno,
        COALESCE(i.nombre_comercial, i.name) AS nombre,
        i.referencia_fabricante,
        i.marca,
        COALESCE(i.stock_actual, 0) AS stock_actual,
        COALESCE(u.abreviatura, i.unit, 'UND') AS unidad_medida,
        c.nombre AS categoria_nombre
      FROM inventario i
      LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
      LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
      WHERE i.id = $1;
    `;
    const prodRes = await query(prodSql, [productoId]);
    if (prodRes.rows.length === 0) return null;
    const producto = prodRes.rows[0];

    // 2. Último precio registrado en compras
    const ultimoPrecioSql = `
      SELECT 
        cr.id AS compra_id,
        cr.precio_unitario AS ultimo_precio,
        cr.fecha_compra AS ultima_fecha_compra,
        cr.numero_factura AS ultima_factura,
        cr.proveedor_id,
        COALESCE(p.nombre_comercial, p.razon_social) AS ultimo_proveedor,
        cr.created_at
      FROM compras_registro cr
      LEFT JOIN proveedores p ON p.id = cr.proveedor_id
      WHERE cr.producto_id = $1
      ORDER BY cr.fecha_compra DESC, cr.created_at DESC
      LIMIT 1;
    `;
    const precioRes = await query(ultimoPrecioSql, [productoId]);
    const ultimoRegistro = precioRes.rows[0] || null;

    return {
      ...producto,
      ultimo_precio: ultimoRegistro ? parseFloat(ultimoRegistro.ultimo_precio) : null,
      ultima_fecha_compra: ultimoRegistro ? ultimoRegistro.ultima_fecha_compra : null,
      ultima_factura: ultimoRegistro ? ultimoRegistro.ultima_factura : null,
      ultimo_proveedor: ultimoRegistro ? ultimoRegistro.ultimo_proveedor : null,
      ultimo_proveedor_id: ultimoRegistro ? ultimoRegistro.proveedor_id : null,
    };
  }

  /**
   * Guarda un nuevo registro de compra dentro de una transacción.
   */
  async insertarCompra(datos, client) {
    const conn = client || db;

    // Generar consecutivo COM-00001
    const seqRes = await conn.query("SELECT nextval('seq_compras_registro') as seq");
    const consecutivo = `COM-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

    const precioUnitario = parseFloat(datos.precio_unitario);
    const cantidad = parseFloat(datos.cantidad);
    const ivaPct = parseFloat(datos.iva_pct || 0);
    const subtotal = Math.round(precioUnitario * cantidad * 100) / 100;
    const ivaValor = Math.round(subtotal * (ivaPct / 100) * 100) / 100;
    const total = subtotal + ivaValor;

    const sql = `
      INSERT INTO compras_registro (
        consecutivo,
        numero_factura,
        fecha_compra,
        proveedor_id,
        producto_id,
        cantidad,
        precio_unitario,
        iva_pct,
        iva_valor,
        total,
        observaciones,
        registrado_por,
        movimiento_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const params = [
      consecutivo,
      datos.numero_factura.trim(),
      datos.fecha_compra,
      datos.proveedor_id,
      datos.producto_id,
      cantidad,
      precioUnitario,
      ivaPct,
      ivaValor,
      total,
      datos.observaciones || null,
      datos.registrado_por || null,
      datos.movimiento_id || null
    ];

    const result = await conn.query(sql, params);
    return result.rows[0];
  }

  /**
   * Actualiza el movimiento_id vinculado a una compra.
   */
  async vincularMovimiento(compraId, movimientoId, client) {
    const conn = client || db;
    await conn.query(
      'UPDATE compras_registro SET movimiento_id = $1 WHERE id = $2',
      [movimientoId, compraId]
    );
  }

  /**
   * Listado paginado del historial de compras con filtros.
   */
  async getHistorialCompras({ page = 1, limit = 20, search = '', proveedorId = null, productoId = null, fechaDesde = null, fechaHasta = null }) {
    const offset = (page - 1) * limit;
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (search && search.trim() !== '') {
      conditions.push(`(
        cr.numero_factura ILIKE $${i} 
        OR cr.consecutivo ILIKE $${i} 
        OR p.razon_social ILIKE $${i} 
        OR p.nombre_comercial ILIKE $${i} 
        OR i.codigo_interno ILIKE $${i} 
        OR i.nombre_comercial ILIKE $${i}
      )`);
      params.push(`%${search.trim()}%`);
      i++;
    }

    if (proveedorId) {
      conditions.push(`cr.proveedor_id = $${i}`);
      params.push(proveedorId);
      i++;
    }

    if (productoId) {
      conditions.push(`cr.producto_id = $${i}`);
      params.push(productoId);
      i++;
    }

    if (fechaDesde) {
      conditions.push(`cr.fecha_compra >= $${i}`);
      params.push(fechaDesde);
      i++;
    }

    if (fechaHasta) {
      conditions.push(`cr.fecha_compra <= $${i}`);
      params.push(fechaHasta);
      i++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*) AS total
      FROM compras_registro cr
      JOIN proveedores p ON p.id = cr.proveedor_id
      JOIN inventario i ON i.id = cr.producto_id
      WHERE ${whereClause};
    `;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const listSql = `
      SELECT 
        cr.id,
        cr.consecutivo,
        cr.numero_factura,
        cr.fecha_compra,
        cr.cantidad,
        cr.precio_unitario,
        cr.subtotal,
        cr.iva_pct,
        cr.iva_valor,
        cr.total,
        cr.observaciones,
        cr.registrado_por,
        cr.created_at,
        p.id AS proveedor_id,
        COALESCE(p.nombre_comercial, p.razon_social) AS proveedor_nombre,
        p.numero_documento AS proveedor_nit,
        i.id AS producto_id,
        COALESCE(i.codigo_interno, i.sku, 'S/C') AS producto_codigo,
        COALESCE(i.nombre_comercial, i.name) AS producto_nombre,
        COALESCE(u.abreviatura, i.unit, 'UND') AS unidad_medida,
        c.nombre AS categoria_nombre
      FROM compras_registro cr
      JOIN proveedores p ON p.id = cr.proveedor_id
      JOIN inventario i ON i.id = cr.producto_id
      LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
      LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
      WHERE ${whereClause}
      ORDER BY cr.fecha_compra DESC, cr.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;

    params.push(limit, offset);
    const listRes = await query(listSql, params);

    return {
      compras: listRes.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Historial de precios de compra para un producto específico (auditoría / gráfica).
   */
  async getHistorialPreciosPorProducto(productoId) {
    const sql = `
      SELECT 
        cr.id,
        cr.fecha_compra,
        cr.numero_factura,
        cr.cantidad,
        cr.precio_unitario,
        cr.total,
        COALESCE(p.nombre_comercial, p.razon_social) AS proveedor,
        cr.created_at
      FROM compras_registro cr
      JOIN proveedores p ON p.id = cr.proveedor_id
      WHERE cr.producto_id = $1
      ORDER BY cr.fecha_compra DESC, cr.created_at DESC;
    `;
    const res = await query(sql, [productoId]);
    return res.rows;
  }

  /**
   * Métodos Legacy para consulta histórica de OC preexistentes
   */
  async getOrdenesCompraLegacy() {
    const res = await query(`
      SELECT o.*, COALESCE(p.nombre_comercial, p.razon_social) AS proveedor_nombre
      FROM ordenes_compra o
      LEFT JOIN proveedores p ON o.proveedor_id = p.id
      ORDER BY o.created_at DESC;
    `);
    return res.rows;
  }

  async getOrdenCompraLegacyById(id) {
    const ocRes = await query(`
      SELECT o.*, COALESCE(p.nombre_comercial, p.razon_social) AS proveedor_nombre
      FROM ordenes_compra o
      LEFT JOIN proveedores p ON o.proveedor_id = p.id
      WHERE o.id = $1;
    `, [id]);
    if (ocRes.rows.length === 0) return null;
    const itemsRes = await query('SELECT * FROM oc_items WHERE orden_compra_id = $1', [id]);
    return { ...ocRes.rows[0], items: itemsRes.rows };
  }
}

export const comprasRepository = new ComprasRepository();
