import { query } from '../../config/database.js';
import * as movimientoService from '../../services/inventoryMovements.service.js';
import { BadRequestError } from '../../utils/errors.js';

/** Returns value if it's a valid UUID, otherwise null */
const toUuid = (v) => {
  if (!v || typeof v !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
};

export class CatalogRepository {
  /**
   * List items from the unified catalog using the view.
   */
  async findAll({ tipo, categoria, search, con_stock, limit = 20, offset, page = 1, sort_by = 'nombre_comercial', sort_dir = 'ASC' }) {
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedOffset = offset !== undefined ? Math.max(0, Number(offset) || 0) : (parsedPage - 1) * parsedLimit;

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
    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push(`(
        nombre_comercial ILIKE $${i} OR
        nombre_interno ILIKE $${i} OR
        codigo_interno ILIKE $${i} OR
        referencia_fabricante ILIKE $${i} OR
        referencia_sistema ILIKE $${i} OR
        marca ILIKE $${i} OR
        (search_vector IS NOT NULL AND search_vector @@ plainto_tsquery('spanish', $${i + 1}))
      )`);
      params.push(term, search.trim());
      i += 2;
    }
    if (con_stock === 'true') {
      conditions.push(`stock_actual > 0`);
    }

    // Whitelist estricta de ordenamiento seguro
    const ALLOWED_SORT_FIELDS = {
      nombre_comercial: 'nombre_comercial',
      codigo_interno: 'codigo_interno',
      categoria_nombre: 'categoria_nombre',
      codigo_ubicacion: 'codigo_ubicacion',
      stock_actual: 'stock_actual',
      precio_venta: 'precio_venta',
      costo_o_minimo: 'costo_o_minimo',
      created_at: 'created_at'
    };

    const sortField = ALLOWED_SORT_FIELDS[sort_by] || 'nombre_comercial';
    const direction = String(sort_dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = conditions.join(' AND ');
    const limitIdx = i++;
    const offsetIdx = i++;
    params.push(parsedLimit, parsedOffset);

    const sql = `
      SELECT * FROM catalogo_completo
      WHERE ${whereClause}
      ORDER BY ${sortField} ${direction} NULLS LAST
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

    const total = parseInt(count.rows[0].count) || 0;

    return {
      items: items.rows,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit) || 1,
      sort_by: sortField,
      sort_dir: direction
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
    if (q && q.trim() !== '') {
      const term = `%${q.trim()}%`;
      conditions.push(`(
        nombre_comercial ILIKE $${i} OR
        nombre_interno ILIKE $${i} OR
        codigo_interno ILIKE $${i} OR
        referencia_fabricante ILIKE $${i} OR
        referencia_sistema ILIKE $${i} OR
        marca ILIKE $${i} OR
        (search_vector IS NOT NULL AND search_vector @@ plainto_tsquery('spanish', $${i + 1}))
      )`);
      params.push(term, q.trim());
      i += 2;
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
             ub.codigo_ubicacion AS ubicacion_default_codigo,
             (SELECT COUNT(*) FROM inventario WHERE categoria_id = c.id AND tipo = 'PRODUCTO' AND activo_catalogo = TRUE) AS total_productos,
             (SELECT COUNT(*) FROM inventario WHERE categoria_id = c.id AND tipo = 'SERVICIO' AND activo_catalogo = TRUE) AS total_servicios
      FROM catalogo_categorias c
      LEFT JOIN ubicaciones_bodega ub ON ub.id = c.ubicacion_default_id
      WHERE c.activo = TRUE
      ORDER BY orden ASC
    `);
    return res.rows;
  }

  async findCategoriaById(id) {
    const res = await query('SELECT * FROM catalogo_categorias WHERE id = $1', [id]);
    return res.rows[0];
  }

  async createCategoria(data) {
    const { nombre, slug, descripcion, tipo_aplicable, color_hex, icono, orden, ubicacion_default_id, codigo_interno_base } = data;

    const baseCode = parseInt(codigo_interno_base, 10);
    if (!baseCode || isNaN(baseCode) || baseCode <= 0) {
      throw new BadRequestError('Debe especificar un consecutivo inicial válido (número mayor a 0) para la familia');
    }

    // Validar que el consecutivo base no esté en uso por otra familia activa
    const existing = await query(
      'SELECT id, nombre, codigo_interno_base FROM catalogo_categorias WHERE codigo_interno_base = $1 AND activo = TRUE',
      [baseCode]
    );
    if (existing.rows.length > 0) {
      throw new BadRequestError(`El consecutivo base ${baseCode} ya está en uso por la familia "${existing.rows[0].nombre}". Ingrese un consecutivo diferente.`);
    }

    const finalUbicacionId = toUuid(ubicacion_default_id) || null;

    const res = await query(`
      INSERT INTO catalogo_categorias 
        (nombre, slug, descripcion, tipo_aplicable, color_hex, icono, orden, ubicacion_default_id, codigo_interno_base, ultimo_codigo_int)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
      RETURNING *
    `, [nombre, slug, descripcion, tipo_aplicable || 'AMBOS', color_hex, icono, orden || 0, finalUbicacionId, baseCode]);
    return res.rows[0];
  }

  async updateCategoria(id, data) {
    const fields = [];
    const params = [id];
    let i = 2;

    if ('codigo_interno_base' in data && data.codigo_interno_base !== undefined && data.codigo_interno_base !== null && data.codigo_interno_base !== '') {
      const baseCode = parseInt(data.codigo_interno_base, 10);
      if (isNaN(baseCode) || baseCode <= 0) {
        throw new BadRequestError('El consecutivo inicial debe ser un número mayor a 0');
      }
      // Validar si otra categoría activa ya tiene este codigo_interno_base
      const existing = await query(
        'SELECT id, nombre FROM catalogo_categorias WHERE codigo_interno_base = $1 AND id != $2 AND activo = TRUE',
        [baseCode, id]
      );
      if (existing.rows.length > 0) {
        throw new BadRequestError(`El consecutivo base ${baseCode} ya está en uso por la familia "${existing.rows[0].nombre}". Ingrese un consecutivo diferente.`);
      }
    }

    const allowed = ['nombre', 'slug', 'descripcion', 'tipo_aplicable', 'color_hex', 'icono', 'orden', 'activo', 'ubicacion_default_id', 'codigo_interno_base'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        let value = data[key];
        if (key === 'ubicacion_default_id') {
          value = toUuid(value) || null;
        } else if (key === 'codigo_interno_base') {
          value = parseInt(value, 10) || null;
        }
        params.push(value);
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
   * Generate the next internal code for a given item.
   *
   * When a categoria_id is provided the DB function
   * `generar_codigo_por_familia` is called; it atomically increments the
   * family counter and returns the next numeric code (e.g. "1000", "2001").
   *
   * Falls back to legacy PRD-/SRV- format only when no category is given or
   * the DB function is not yet available.
   *
   * @param {string} tipo       - 'PRODUCTO' | 'SERVICIO'
   * @param {string|null} categoriaId - UUID of the family / category
   */
  async _generarCodigo(tipo, categoriaId = null) {
    // --- Primary path: per-family numeric code ---
    if (categoriaId) {
      try {
        const res = await query(
          'SELECT generar_codigo_por_familia($1) AS code',
          [categoriaId]
        );
        if (res.rows[0]?.code) return res.rows[0].code;
      } catch (err) {
        console.warn('[CatalogRepository] generar_codigo_por_familia failed, falling back:', err.message);
      }
    }

    // --- Legacy fallback: PRD-00001 / SRV-00001 ---
    try {
      const res = await query('SELECT generar_codigo_catalogo($1) AS code', [tipo]);
      if (res.rows[0]?.code) return res.rows[0].code;
    } catch { /* ignore */ }

    const prefix = tipo === 'SERVICIO' ? 'SRV' : 'PRD';
    const seqRes = await query(
      'SELECT COUNT(*) AS total FROM inventario WHERE tipo = $1',
      [tipo]
    );
    const next = parseInt(seqRes.rows[0].total) + 1;
    return `${prefix}-${String(next).padStart(5, '0')}`;
  }

  async getSiguienteConsecutivoUbicacion(categoriaId) {
    if (!categoriaId) return { siguiente_numero: 1, codigo: '001' };
    const res = await query(`
      SELECT COALESCE(
        MAX(
          CASE 
            WHEN ub.codigo_ubicacion ~ '^\\d+$' THEN ub.codigo_ubicacion::INTEGER 
            ELSE 0 
          END
        ), 0) + 1 AS siguiente_numero
      FROM inventario i
      JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
      WHERE i.categoria_id = $1 AND i.tipo = 'PRODUCTO'
    `, [categoriaId]);

    const nextNum = parseInt(res.rows[0]?.siguiente_numero || 1);
    const codeStr = String(nextNum).padStart(3, '0');
    return { siguiente_numero: nextNum, codigo: codeStr };
  }

  /**
   * Preview the next internal code for a family WITHOUT consuming it.
   * Reads codigo_interno_base + ultimo_codigo_int from catalogo_categorias.
   * This is a non-destructive read used by the frontend to show the user
   * what code will be assigned before they save.
   */
  async previsualizarCodigoPorFamilia(categoriaId) {
    if (!categoriaId) return { siguiente_codigo: null, familia: null };

    const res = await query(
      `SELECT nombre, codigo_interno_base, ultimo_codigo_int
         FROM catalogo_categorias
        WHERE id = $1`,
      [categoriaId]
    );

    if (!res.rows[0]) return { siguiente_codigo: null, familia: null };

    const { nombre, codigo_interno_base, ultimo_codigo_int } = res.rows[0];

    // Next code = base + current_counter (the next INSERT will do base + counter+1)
    const base = parseInt(codigo_interno_base) || 0;
    const offset = parseInt(ultimo_codigo_int) || 0;
    const siguienteCodigo = (base + offset).toString();

    return {
      siguiente_codigo: siguienteCodigo,
      familia: nombre,
      base,
      offset
    };
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

    const codigo = codigo_interno || await this._generarCodigo(tipo, toUuid(categoria_id));


    // Ubicacion: si no se envía explícitamente pero la familia tiene una asignada por defecto, se asigna esa
    let ubicacionFinal = toUuid(ubicacion_id);
    if (!ubicacionFinal && toUuid(categoria_id)) {
      const famRes = await query('SELECT ubicacion_default_id FROM catalogo_categorias WHERE id = $1', [toUuid(categoria_id)]);
      ubicacionFinal = famRes.rows[0]?.ubicacion_default_id || null;
    }


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
      ubicacionFinal,
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

  /**
   * Adjust stock for a given inventory item.
   * @param {string} id - UUID of the inventory item.
   * @param {number} nuevoStock - Desired stock quantity (non‑negative).
   * @param {string} userId - ID of the user performing the adjustment.
   * @param {string} [motivo] - Optional reason for the adjustment.
   * @returns Updated inventory row.
   */
  async adjustStock(id, nuevoStock, userId, motivo = null) {
    // Begin transaction
    await query('BEGIN');
    try {
      // Lock the row to avoid race conditions
      const lockRes = await query('SELECT stock_actual FROM inventario WHERE id = $1 FOR UPDATE', [id]);
      if (lockRes.rowCount === 0) {
        throw new Error('Item not found');
      }
      const stockActual = parseFloat(lockRes.rows[0].stock_actual);
      const delta = parseFloat(nuevoStock) - stockActual;

      // Update stock
      await query('UPDATE inventario SET stock_actual = $1, updated_by = $2, updated_at = NOW() WHERE id = $3', [nuevoStock, userId, id]);

      // Register movement if there is a change
      if (delta !== 0) {
        const tipoMovimiento = delta > 0 ? 'ENTRADA_AJUSTE' : 'SALIDA_AJUSTE';
        await movimientoService.registrarMovimiento({
          inventario_id: id,
          tipo_movimiento: tipoMovimiento,
          cantidad: Math.abs(delta),
          notas: motivo || (tipoMovimiento === 'ENTRADA_AJUSTE' ? 'Ajuste de stock +' : 'Ajuste de stock -'),
          registrado_por: userId,
        });
      }

      await query('COMMIT');
      // Return updated row
      const res = await query('SELECT * FROM inventario WHERE id = $1', [id]);
      return res.rows[0];
    } catch (err) {
      await query('ROLLBACK');
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
      'stock_actual', 'stock_minimum', 'stock_maximo', 'ubicacion_id', 'marca',
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

  async importItems(rows, userId) {
    // Función de normalización de texto (sin acentos, minúsculas)
    const normalizeStr = (str) => {
      if (!str) return '';
      return String(str).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    const catRes = await query('SELECT id, nombre, slug FROM catalogo_categorias');
    const catMap = new Map();
    for (const c of catRes.rows) {
      if (c.nombre) {
        catMap.set(c.nombre.trim().toLowerCase(), c.id);
        catMap.set(normalizeStr(c.nombre), c.id);
      }
      if (c.slug) {
        catMap.set(c.slug.trim().toLowerCase(), c.id);
        catMap.set(normalizeStr(c.slug), c.id);
      }
    }

    const uniRes = await query('SELECT id, nombre, abreviatura FROM unidades_medida');
    const uniMap = new Map();
    for (const u of uniRes.rows) {
      if (u.nombre) {
        uniMap.set(u.nombre.trim().toLowerCase(), u.id);
        uniMap.set(normalizeStr(u.nombre), u.id);
      }
      if (u.abreviatura) {
        uniMap.set(u.abreviatura.trim().toLowerCase(), u.id);
        uniMap.set(normalizeStr(u.abreviatura), u.id);
      }
    }

    let creados = 0;
    let actualizados = 0;
    const errores = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const raw = rows[idx];
      const filaNum = idx + 2; // Considerando fila 1 como encabezados

      try {
        // Normalizar claves
        const getVal = (...keys) => {
          for (const k of keys) {
            for (const rowKey of Object.keys(raw)) {
              if (rowKey.trim().toLowerCase() === k.toLowerCase()) {
                const val = raw[rowKey];
                return val !== undefined && val !== null ? String(val).trim() : '';
              }
            }
          }
          return '';
        };

        const getNum = (...keys) => {
          const val = getVal(...keys);
          if (!val) return 0;
          const clean = String(val).replace(/[^0-9.-]+/g, '');
          const n = parseFloat(clean);
          return isNaN(n) ? 0 : n;
        };

        const getBool = (...keys) => {
          const val = getVal(...keys).toLowerCase();
          if (!val) return true;
          return val === 'si' || val === 'sí' || val === 'true' || val === '1' || val === 'yes';
        };

        const codigoInterno = getVal('código interno', 'codigo interno', 'código', 'codigo', 'codigo_interno', 'sku');
        const nombreComercial = getVal('nombre comercial', 'nombre', 'nombre_comercial', 'item', 'descripcion', 'descripción');
        const referencia = getVal('referencia', 'ref', 'name', 'nombre interno', 'nombre_interno') || nombreComercial;
        
        let tipo = (getVal('tipo', 'tipo de item') || 'PRODUCTO').toUpperCase();
        if (!['PRODUCTO', 'SERVICIO'].includes(tipo)) {
          tipo = 'PRODUCTO';
        }

        if (!nombreComercial && !referencia && !codigoInterno) {
          // Fila completamente vacía o sin identificador
          continue;
        }

        if (!nombreComercial && !referencia) {
          throw new Error('El nombre comercial o referencia es obligatorio');
        }

        // Resolver familia / categoría
        const famNombre = getVal('familia', 'categoría', 'categoria', 'categoria_nombre', 'familia_nombre');
        let categoriaId = null;
        if (famNombre) {
          categoriaId = catMap.get(famNombre.trim().toLowerCase()) || catMap.get(normalizeStr(famNombre)) || null;
        }
        if (!categoriaId && catRes.rows.length > 0) {
          // Si no se especificó o no se encontró, tomar la primera familia o error según el caso
          if (tipo === 'PRODUCTO' && famNombre) {
            throw new Error(`Familia "${famNombre}" no encontrada en el sistema`);
          }
        }

        // Resolver unidad de medida
        const uniNombre = getVal('unidad de medida', 'unidad', 'unidad_medida', 'um');
        let unidadMedidaId = null;
        if (uniNombre) {
          unidadMedidaId = uniMap.get(uniNombre.trim().toLowerCase()) || uniMap.get(normalizeStr(uniNombre)) || null;
        }
        if (!unidadMedidaId && tipo === 'PRODUCTO' && uniRes.rows.length > 0) {
          // Fallback a "Unidad" o primer elemento
          unidadMedidaId = uniMap.get('unidad') || uniMap.get('und') || uniRes.rows[0].id;
        }

        // Parsear referencias cruzadas y equipos compatibles (separados por coma o punto y coma)
        const parseList = (str) => {
          if (!str) return [];
          return str.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        };

        const refCruzada = parseList(getVal('referencias cruzadas', 'referencia cruzada', 'referencia_cruzada'));
        const eqCompatibles = parseList(getVal('equipos compatibles', 'equipo compatible', 'equipos_compatibles'));

        // Verificar si existe el item por codigo_interno
        let existing = null;
        if (codigoInterno) {
          const checkRes = await query('SELECT id, codigo_interno, ubicacion_id FROM inventario WHERE LOWER(codigo_interno) = LOWER($1)', [codigoInterno]);
          if (checkRes.rows.length > 0) {
            existing = checkRes.rows[0];
          }
        }

        if (existing) {
          // ACTUALIZAR item existente
          const updateData = {
            nombre_comercial: nombreComercial || referencia,
            name: referencia || nombreComercial,
            marca: getVal('marca') || undefined,
            tipo_repuesto: getVal('clasificación técnica', 'clasificacion tecnica', 'tipo repuesto', 'tipo_repuesto') || undefined,
            costo_reposicion: getNum('costo', 'costo unitario', 'unit_cost', 'costo_reposicion'),
            unit_price: getNum('precio unitario', 'precio venta', 'precio de venta', 'precio', 'unit_price'),
            stock_minimum: getNum('stock mínimo', 'stock minimo', 'stock_minimum'),
            precio_servicio: getNum('precio servicio', 'precio_servicio'),
            precio_servicio_minimo: getNum('precio servicio mínimo', 'precio servicio minimo', 'precio_servicio_minimo'),
            unidad_cobro: getVal('unidad de cobro', 'unidad cobro', 'unidad_cobro') || undefined,
            aplica_iva: getBool('aplica iva', 'iva', 'aplica_iva'),
            iva_pct: getNum('porcentaje iva', 'iva %', 'iva_pct') || 19,
          };

          if (categoriaId) updateData.categoria_id = categoriaId;
          if (unidadMedidaId) updateData.unidad_medida_id = unidadMedidaId;
          if (refCruzada.length > 0) updateData.referencia_cruzada = refCruzada;
          if (eqCompatibles.length > 0) updateData.equipos_compatibles = eqCompatibles;

          // Si viene stock actual especificado, se actualiza también
          const rawStock = getVal('stock actual', 'stock', 'stock_current', 'stock_actual');
          if (rawStock !== '') {
            updateData.stock_actual = getNum('stock actual', 'stock', 'stock_current', 'stock_actual');
          }

          await this.update(existing.id, updateData, userId);
          actualizados++;
        } else {
          // CREAR nuevo item
          const createData = {
            tipo,
            codigo_interno: codigoInterno || undefined,
            name: referencia || nombreComercial,
            nombre_comercial: nombreComercial || referencia,
            categoria_id: categoriaId,
            unidad_medida_id: unidadMedidaId,
            marca: getVal('marca') || null,
            tipo_repuesto: getVal('clasificación técnica', 'clasificacion tecnica', 'tipo repuesto', 'tipo_repuesto') || 'N/A',
            costo_reposicion: getNum('costo', 'costo unitario', 'unit_cost', 'costo_reposicion'),
            unit_price: getNum('precio unitario', 'precio venta', 'precio de venta', 'precio', 'unit_price'),
            stock_actual: getNum('stock actual', 'stock', 'stock_current', 'stock_actual'),
            stock_minimum: getNum('stock mínimo', 'stock minimo', 'stock_minimum'),
            precio_servicio: getNum('precio servicio', 'precio_servicio'),
            precio_servicio_minimo: getNum('precio servicio mínimo', 'precio servicio minimo', 'precio_servicio_minimo'),
            unidad_cobro: getVal('unidad de cobro', 'unidad cobro', 'unidad_cobro') || 'hora',
            aplica_iva: getBool('aplica iva', 'iva', 'aplica_iva'),
            iva_pct: getNum('porcentaje iva', 'iva %', 'iva_pct') || 19,
            referencia_cruzada: refCruzada,
            equipos_compatibles: eqCompatibles,
            area: 'MANTENIMIENTO',
            ubicacion_id: null // El método create calculará el consecutivo por familia automáticamente
          };

          await this.create(createData, userId);
          creados++;
        }
      } catch (err) {
        errores.push({
          fila: filaNum,
          codigo: raw['Código Interno'] || raw['codigo_interno'] || raw['Código'] || raw['Referencia'] || `Fila ${filaNum}`,
          error: err.message
        });
      }
    }

    return {
      total: rows.length,
      creados,
      actualizados,
      errores
    };
  }

  /**
   * Informe de catálogo con filtros de rango de fechas y tipo (Productos / Servicios / Todos)
   */
  async getInforme({ fecha_desde, fecha_hasta, tipo, search, categoria_id, limit = 5000, offset = 0 }) {
    const conditions = ['activo_catalogo = TRUE'];
    const params = [];
    let i = 1;

    if (tipo && tipo !== 'todos') {
      conditions.push(`tipo = $${i++}`);
      params.push(tipo);
    }

    if (fecha_desde) {
      conditions.push(`created_at >= $${i++}`);
      params.push(`${fecha_desde} 00:00:00`);
    }

    if (fecha_hasta) {
      conditions.push(`created_at <= $${i++}`);
      params.push(`${fecha_hasta} 23:59:59`);
    }

    if (categoria_id) {
      conditions.push(`(categoria_id::text = $${i} OR categoria_nombre = $${i})`);
      params.push(categoria_id);
      i++;
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push(`(
        nombre_comercial ILIKE $${i} OR
        nombre_interno ILIKE $${i} OR
        codigo_interno ILIKE $${i} OR
        referencia_fabricante ILIKE $${i} OR
        referencia_sistema ILIKE $${i} OR
        marca ILIKE $${i}
      )`);
      params.push(term);
      i++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Resumen / Métricas de totales
    const summarySql = `
      SELECT 
        COUNT(*)::INT AS total_registros,
        COUNT(CASE WHEN tipo = 'PRODUCTO' THEN 1 END)::INT AS total_productos,
        COUNT(CASE WHEN tipo = 'SERVICIO' THEN 1 END)::INT AS total_servicios,
        COALESCE(SUM(CASE WHEN tipo = 'PRODUCTO' THEN stock_actual ELSE 0 END), 0)::NUMERIC AS total_stock,
        COALESCE(SUM(CASE WHEN tipo = 'PRODUCTO' THEN stock_actual * COALESCE(costo_o_minimo, 0) ELSE 0 END), 0)::NUMERIC AS valor_inventario_costo,
        COALESCE(SUM(CASE WHEN tipo = 'PRODUCTO' THEN stock_actual * COALESCE(precio_venta, 0) ELSE 0 END), 0)::NUMERIC AS valor_inventario_venta
      FROM catalogo_completo
      WHERE ${whereClause}
    `;

    // 2. Registros detallados
    const parsedLimit = Math.min(10000, Math.max(1, Number(limit) || 5000));
    const parsedOffset = Math.max(0, Number(offset) || 0);

    const dataSql = `
      SELECT 
        id,
        tipo,
        codigo_interno,
        nombre_comercial,
        nombre_interno,
        referencia_fabricante,
        referencia_sistema,
        marca,
        area,
        categoria_nombre,
        categoria_color,
        unidad_medida,
        codigo_ubicacion,
        stock_actual,
        stock_minimo,
        precio_venta,
        costo_o_minimo,
        aplica_iva,
        iva_pct,
        is_active,
        created_at,
        updated_at
      FROM catalogo_completo
      WHERE ${whereClause}
      ORDER BY created_at DESC, codigo_interno ASC
      LIMIT $${i++} OFFSET $${i++}
    `;
    const dataParams = [...params, parsedLimit, parsedOffset];

    const [summaryRes, dataRes] = await Promise.all([
      query(summarySql, params),
      query(dataSql, dataParams)
    ]);

    return {
      summary: summaryRes.rows[0] || {
        total_registros: 0,
        total_productos: 0,
        total_servicios: 0,
        total_stock: 0,
        valor_inventario_costo: 0,
        valor_inventario_venta: 0
      },
      items: dataRes.rows,
      total: summaryRes.rows[0]?.total_registros || 0
    };
  }
}
