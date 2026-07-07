import { query } from '../../config/database.js';

/** Returns value if it's a valid UUID, otherwise null */
const toUuid = (v) => {
  if (!v || typeof v !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
};

export class CatalogRepository {
  /**
   * List items from the unified catalog using the view.
   */
  async findAll({ tipo, categoria, search, con_stock, limit = 20, offset = 0 }) {
    const conditions = ['activo_catalogo = TRUE'];
    const params = [];
    let i = 1;

    if (tipo && tipo !== 'todos') {
      conditions.push(`tipo = $${i++}`);
      params.push(tipo);
    }
    if (categoria) {
      conditions.push(`(categoria_nombre = $${i} OR categoria_id::text = $${i})`);
      params.push(categoria);
      i++;
    }
    if (search) {
      conditions.push(`search_vector @@ plainto_tsquery('spanish', $${i})`);
      params.push(search);
      i++;
    }
    if (con_stock === 'true') {
      conditions.push(`stock_actual > 0`);
    }

    const whereClause = conditions.join(' AND ');
    const limitIdx = i++;
    const offsetIdx = i++;
    params.push(Number(limit), Number(offset));

    const sql = `
      SELECT * FROM catalogo_completo
      WHERE ${whereClause}
      ORDER BY nombre_comercial ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const countSql = `
      SELECT COUNT(*) FROM catalogo_completo
      WHERE ${whereClause}
    `;

    // count params = everything except the limit/offset at the end
    const countParams = params.slice(0, params.length - 2);

    const [items, count] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    return {
      items: items.rows,
      total: parseInt(count.rows[0].count),
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  async findById(id) {
    const res = await query('SELECT * FROM catalogo_completo WHERE id = $1', [id]);
    return res.rows[0];
  }

  async getSearch(q, tipo, limit = 10) {
    const conditions = ['activo_catalogo = TRUE'];
    const params = [Number(limit)];
    let i = 2;

    if (tipo && tipo !== 'AMBOS') {
      conditions.push(`tipo = $${i++}`);
      params.push(tipo);
    }
    if (q) {
      conditions.push(`search_vector @@ plainto_tsquery('spanish', $${i})`);
      params.push(q);
      i++;
    }

    // Use only columns that exist in the catalogo_completo view
    const sql = `
      SELECT id, tipo, codigo_interno, nombre_comercial,
             precio_venta, costo_o_minimo,
             unidad_medida, stock_actual
      FROM catalogo_completo
      WHERE ${conditions.join(' AND ')}
      LIMIT $1
    `;
    const res = await query(sql, params);
    return res.rows;
  }

  async getAlertas() {
    // Query items below minimum stock directly (alertas_stock view may not exist yet)
    const res = await query(`
      SELECT
        i.id,
        i.codigo_interno,
        COALESCE(i.nombre_comercial, i.name) AS nombre_comercial,
        i.stock_actual AS stock_actual,
        i.stock_minimum AS stock_minimo,
        (i.stock_minimum - i.stock_actual) AS deficit,
        c.nombre AS categoria,
        c.color_hex AS categoria_color,
        u.abreviatura AS unidad,
        CASE
          WHEN i.stock_actual <= 0 THEN 'AGOTADO'
          ELSE 'STOCK BAJO'
        END AS tipo_alerta
      FROM inventario i
      LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
      LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
      WHERE i.tipo = 'PRODUCTO'
        AND i.is_active = TRUE
        AND i.stock_actual <= i.stock_minimum
      ORDER BY deficit DESC
      LIMIT 50
    `);
    return res.rows;
  }

  async getCategorias() {
    const res = await query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM inventario WHERE categoria_id = c.id AND tipo = 'PRODUCTO' AND activo_catalogo = TRUE) AS total_productos,
             (SELECT COUNT(*) FROM inventario WHERE categoria_id = c.id AND tipo = 'SERVICIO' AND activo_catalogo = TRUE) AS total_servicios
      FROM catalogo_categorias c
      WHERE activo = TRUE
      ORDER BY orden ASC
    `);
    return res.rows;
  }

  async findCategoriaById(id) {
    const res = await query('SELECT * FROM catalogo_categorias WHERE id = $1', [id]);
    return res.rows[0];
  }

  async createCategoria(data) {
    const { nombre, slug, descripcion, tipo_aplicable, color_hex, icono, orden } = data;
    const res = await query(`
      INSERT INTO catalogo_categorias 
        (nombre, slug, descripcion, tipo_aplicable, color_hex, icono, orden)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [nombre, slug, descripcion, tipo_aplicable || 'AMBOS', color_hex, icono, orden || 0]);
    return res.rows[0];
  }

  async updateCategoria(id, data) {
    const fields = [];
    const params = [id];
    let i = 2;

    const allowed = ['nombre', 'slug', 'descripcion', 'tipo_aplicable', 'color_hex', 'icono', 'orden', 'activo'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        params.push(data[key]);
      }
    }

    if (fields.length === 0) return this.findCategoriaById(id);

    const sql = `UPDATE catalogo_categorias SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0];
  }

  async deleteCategoria(id) {
    // Soft delete to avoid breaking relationships
    const res = await query('UPDATE catalogo_categorias SET activo = FALSE WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  }

  async getUnidadesMedida() {
    const res = await query('SELECT * FROM unidades_medida WHERE activo = TRUE ORDER BY tipo, nombre');
    return res.rows;
  }

  /**
   * Generate the next internal code for a given type.
   * Falls back to inline generation if the DB function doesn't exist.
   */
  async _generarCodigo(tipo) {
    try {
      const res = await query('SELECT generar_codigo_catalogo($1) AS code', [tipo]);
      return res.rows[0].code;
    } catch {
      // Fallback: generate code in-app
      const prefix = tipo === 'SERVICIO' ? 'SRV' : 'PRD';
      const seqRes = await query(`
        SELECT COUNT(*) AS total FROM inventario WHERE tipo = $1
      `, [tipo]);
      const next = parseInt(seqRes.rows[0].total) + 1;
      return `${prefix}-${String(next).padStart(5, '0')}`;
    }
  }

  async create(data, userId) {
    const {
      tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id,
      costo_reposicion, unit_price, stock_actual, stock_minimum,
      precio_servicio, precio_servicio_minimo, unidad_cobro,
      aplica_iva, iva_pct, es_destacado, marca, ubicacion_id,
      tipo_repuesto, responsable_id, referencia_cruzada, equipos_compatibles,
      area
    } = data;

    const codigo = codigo_interno || await this._generarCodigo(tipo);

    const sql = `
      INSERT INTO inventario (
        tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id,
        costo_reposicion, unit_price, stock_actual, stock_minimum,
        precio_servicio, precio_servicio_minimo, unidad_cobro,
        aplica_iva, iva_pct, es_destacado, marca, ubicacion_id,
        tipo_repuesto, responsable_id, referencia_cruzada, equipos_compatibles,
        created_by, area
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *
    `;
    const params = [
      tipo,
      codigo,
      name || codigo,
      nombre_comercial || name || codigo,
      toUuid(categoria_id),
      toUuid(unidad_medida_id),
      costo_reposicion    ?? 0,
      unit_price   ?? 0,
      stock_actual ?? 0,
      stock_minimum ?? 0,
      precio_servicio         ?? 0,
      precio_servicio_minimo  ?? 0,
      unidad_cobro || null,
      aplica_iva  ?? true,
      iva_pct     ?? 19,
      es_destacado ?? false,
      marca || null,
      toUuid(ubicacion_id),
      tipo_repuesto || 'N/A',
      toUuid(responsable_id),
      JSON.stringify(referencia_cruzada || []),
      JSON.stringify(equipos_compatibles || []),
      userId,
      area || 'MANTENIMIENTO',
    ];
    try {
      const res = await query(sql, params);
      return res.rows[0];
    } catch (err) {
      console.error("CREATE ITEM ERROR:", err.message);
      console.error("Constraint:", err.constraint);
      console.error("Params:", params);
      throw err;
    }
  }

  async update(id, data, userId) {
    const fields = ['updated_by = $1', 'updated_at = NOW()'];
    const params = [userId, id];
    let i = 3;

    const allowed = [
      'codigo_interno', 'name', 'nombre_comercial', 'descripcion_corta', 'descripcion_larga',
      'categoria_id', 'unidad_medida_id', 'costo_reposicion', 'unit_price',
      'stock_minimum', 'stock_maximo', 'ubicacion_id', 'marca',
      'precio_servicio', 'precio_servicio_minimo', 'unidad_cobro',
      'activo_catalogo', 'activo_compras', 'es_destacado', 'aplica_iva', 'iva_pct',
      'imagen_url', 'imagen_thumb_url',
      'tipo_repuesto', 'responsable_id', 'referencia_cruzada', 'equipos_compatibles',
      'area'
    ];

    const uuidFields = ['categoria_id', 'unidad_medida_id', 'ubicacion_id', 'responsable_id'];

    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        let value = data[key];
        if (key === 'referencia_cruzada' || key === 'equipos_compatibles') {
          value = JSON.stringify(value || []);
        } else if (uuidFields.includes(key)) {
          value = toUuid(value);
        }
        params.push(value);
      }
    }

    const sql = `UPDATE inventario SET ${fields.join(', ')} WHERE id = $2 RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0];
  }

  async delete(id) {
    // Soft delete
    const res = await query(
      'UPDATE inventario SET activo_catalogo = FALSE, is_active = FALSE WHERE id = $1 RETURNING *',
      [id],
    );
    return res.rows[0];
  }
}
