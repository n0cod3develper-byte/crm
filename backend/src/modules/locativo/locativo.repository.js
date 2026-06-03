import { query } from '../../config/database.js';

export class LocativoRepository {
  async findAll({ grupo, subcategoria, clasificacion_contable, sede, estado_fisico, responsable_id, search, limit = 50, page = 1 }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (grupo && grupo !== 'all') {
      conditions.push(`grupo_locativo = $${i++}`);
      params.push(grupo);
    }
    if (subcategoria && subcategoria !== 'all') {
      conditions.push(`subcategoria = $${i++}`);
      params.push(subcategoria);
    }
    if (clasificacion_contable && clasificacion_contable !== 'all') {
      conditions.push(`clasificacion_contable = $${i++}`);
      params.push(clasificacion_contable);
    }
    if (sede && sede.trim() !== '') {
      conditions.push(`sede ILIKE $${i++}`);
      params.push(`%${sede.trim()}%`);
    }
    if (estado_fisico && estado_fisico !== 'all') {
      conditions.push(`estado_fisico = $${i++}`);
      params.push(estado_fisico);
    }
    if (responsable_id) {
      conditions.push(`responsable_id = $${i++}`);
      params.push(responsable_id);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(nombre ILIKE $${i} OR codigo_interno ILIKE $${i} OR codigo_placa ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }

    const offset = (page - 1) * limit;
    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT l.*,
             sc.nombre AS subcategoria_nombre,
             sc.grupo AS subcategoria_grupo,
             emp.full_name AS responsable_nombre
      FROM inventario_locativo l
      LEFT JOIN locativo_subcategorias sc ON sc.codigo = l.subcategoria
      LEFT JOIN employees emp ON emp.id = l.responsable_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT $${i++} OFFSET $${i}
    `;

    const countSql = `
      SELECT COUNT(*) FROM inventario_locativo l
      WHERE ${conditions.join(' AND ')}
    `;

    const [result, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, params.length - 2)) // sin limit/offset
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    const result = await query(
      `SELECT l.*,
              sc.nombre AS subcategoria_nombre,
              sc.grupo AS subcategoria_grupo,
              sc.campos_json,
              emp.full_name AS responsable_nombre,
              prov.nombre AS proveedor_nombre
       FROM inventario_locativo l
       LEFT JOIN locativo_subcategorias sc ON sc.codigo = l.subcategoria
       LEFT JOIN employees emp ON emp.id = l.responsable_id
       LEFT JOIN proveedores prov ON prov.id = l.proveedor_id
       WHERE l.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByCodigoInterno(codigo) {
    const result = await query(
      `SELECT id FROM inventario_locativo WHERE codigo_interno = $1`,
      [codigo]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const fields = [];
    const values = [];
    const placeholders = [];
    let i = 1;

    const allowed = [
      'codigo_interno', 'codigo_placa', 'nombre', 'descripcion',
      'grupo_locativo', 'subcategoria', 'clasificacion_contable',
      'tipo_propiedad', 'cuenta_contable', 'costo_historico',
      'valor_residual', 'vida_util_anios', 'fecha_adquisicion',
      'fecha_inicio_depreciacion', 'metodo_depreciacion',
      'fecha_fin_contrato', 'incluye_prorrogas',
      'sede', 'piso_nivel', 'area_oficina_bodega', 'ubicacion_detalle',
      'direccion_inmueble', 'estado_fisico', 'fecha_ultimo_mantenimiento',
      'responsable_id', 'responsable_nombre',
      'tipo_documento_soporte', 'numero_documento_soporte',
      'proveedor_id', 'proveedor_nombre', 'documento_adjunto_id',
      'especificaciones', 'foto_path', 'foto_url', 'foto_thumb_url',
      'activo', 'observaciones', 'registrado_por',
    ];

    for (const key of allowed) {
      if (key in data && data[key] !== undefined && data[key] !== null) {
        fields.push(key);
        placeholders.push(`$${i++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) {
      throw new Error('No hay datos para insertar');
    }

    const sql = `
      INSERT INTO inventario_locativo (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = [
      'codigo_interno', 'codigo_placa', 'nombre', 'descripcion',
      'grupo_locativo', 'subcategoria', 'clasificacion_contable',
      'tipo_propiedad', 'cuenta_contable', 'costo_historico',
      'valor_residual', 'vida_util_anios', 'fecha_adquisicion',
      'fecha_inicio_depreciacion', 'metodo_depreciacion',
      'fecha_fin_contrato', 'incluye_prorrogas',
      'sede', 'piso_nivel', 'area_oficina_bodega', 'ubicacion_detalle',
      'direccion_inmueble', 'estado_fisico', 'fecha_ultimo_mantenimiento',
      'responsable_id', 'responsable_nombre',
      'tipo_documento_soporte', 'numero_documento_soporte',
      'proveedor_id', 'proveedor_nombre', 'documento_adjunto_id',
      'especificaciones', 'foto_path', 'foto_url', 'foto_thumb_url',
      'activo', 'observaciones', 'registrado_por',
    ];

    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key] === '' ? null : data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const sql = `
      UPDATE inventario_locativo
      SET ${fields.join(', ')}
      WHERE id = $${i}
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async cambiarEstado(id, { estado_fisico, observaciones, autorizado_por }) {
    const item = await this.findById(id);
    if (!item) return null;

    // Actualizar estado
    const result = await query(
      `UPDATE inventario_locativo
       SET estado_fisico = $1, observaciones = COALESCE($2, observaciones)
       WHERE id = $3 RETURNING *`,
      [estado_fisico, observaciones, id]
    );

    // Si es DADO_DE_BAJA, registrar en locativo_bajas
    if (estado_fisico === 'DADO_DE_BAJA') {
      await query(
        `INSERT INTO locativo_bajas (locativo_id, motivo, autorizado_por)
         VALUES ($1, $2, $3)`,
        [id, observaciones || 'Baja sin motivo registrado', autorizado_por || 'Sistema']
      );
    }

    return result.rows[0] || null;
  }

  async getSubcategorias() {
    const result = await query(
      `SELECT * FROM locativo_subcategorias WHERE activo = TRUE ORDER BY orden`
    );
    return result.rows;
  }

  async getResumenContable() {
    const sql = `
      SELECT
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE clasificacion_contable = 'ACTIVO') AS total_activos,
        COUNT(*) FILTER (WHERE clasificacion_contable = 'GASTO') AS total_gastos,
        COALESCE(SUM(costo_historico) FILTER (WHERE clasificacion_contable = 'ACTIVO'), 0) AS valor_total_activos,
        COALESCE(SUM(costo_historico), 0) AS valor_total_inventario,
        COUNT(*) FILTER (WHERE tipo_propiedad = 'ARRENDADA' AND fecha_fin_contrato IS NOT NULL AND fecha_fin_contrato <= CURRENT_DATE + INTERVAL '6 months') AS contratos_por_vencer,
        COUNT(*) FILTER (WHERE tipo_documento_soporte IS NULL OR tipo_documento_soporte = '') AS items_sin_documento,
        COUNT(*) FILTER (WHERE estado_fisico = 'MALO' OR estado_fisico = 'REGULAR') AS items_estado_critico
      FROM inventario_locativo
      WHERE activo = TRUE
    `;

    const result = await query(sql);
    return result.rows[0];
  }

  async generarCodigoLocativo(conn) {
    const anio = new Date().getFullYear();
    const result = await conn.query(`SELECT nextval('seq_inventario_locativo') AS nro`);
    const nro = result.rows[0].nro;
    return `LOC-${anio}-${String(nro).padStart(5, '0')}`;
  }
}
