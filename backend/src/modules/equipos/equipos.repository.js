import { query } from '../../config/database.js';

export class EquiposRepository {
  async findAll({
    empresa_id,
    motor,
    combustible,
    capacidad_carga,
    tipo_equipo,
    estado,
    tipo_propulsion,
    ciudad,
    con_foto,
    soat,
    search,
    limit = 50,
    cursor,
    orden
  }) {
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    let i = 1;

    // Filtros existentes
    if (empresa_id) {
      conditions.push(`empresa_id = $${i++}`);
      params.push(empresa_id);
    }
    if (motor && motor !== 'all') {
      conditions.push(`motor = $${i++}`);
      params.push(motor);
    }
    if (combustible && combustible !== 'all') {
      conditions.push(`combustible = $${i++}`);
      params.push(combustible);
    }
    if (capacidad_carga && capacidad_carga !== 'all') {
      conditions.push(`capacidad_carga = $${i++}`);
      params.push(capacidad_carga);
    }

    // Nuevos filtros
    if (tipo_equipo && tipo_equipo !== 'all') {
      conditions.push(`tipo_equipo = $${i++}`);
      params.push(tipo_equipo);
    }
    if (estado && estado !== 'all') {
      conditions.push(`estado = $${i++}`);
      params.push(estado);
    }
    if (tipo_propulsion && tipo_propulsion !== 'all') {
      conditions.push(`tipo_propulsion = $${i++}`);
      params.push(tipo_propulsion);
    }
    if (ciudad && ciudad.trim() !== '') {
      conditions.push(`ciudad_ubicacion ILIKE $${i++}`);
      params.push(`%${ciudad.trim()}%`);
    }
    if (con_foto !== undefined && con_foto !== null && con_foto !== '') {
      if (con_foto === 'true' || con_foto === true) {
        conditions.push(`foto_path IS NOT NULL AND foto_path <> ''`);
      } else {
        conditions.push(`foto_path IS NULL OR foto_path = ''`);
      }
    }

    // Filtro SOAT: alertas (vigente y por vencer en ≤30 días o vencido)
    if (soat === 'alerta') {
      conditions.push(`soat_vigente = TRUE AND soat_vencimiento IS NOT NULL AND soat_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')`);
    }

    // Búsqueda extendida
    if (search && search.trim() !== '') {
      conditions.push(`(marca ILIKE $${i} OR modelo ILIKE $${i} OR serial ILIKE $${i} OR serie ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }

    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM equipos WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    // Mapeo seguro de columnas de ordenamiento para evitar inyección de SQL
    let sortColumn = 'created_at';
    let sortOrder = 'DESC';

    if (orden) {
      const allowedSort = ['marca', 'modelo', 'estado', 'horometro_actual', 'created_at'];
      if (allowedSort.includes(orden)) {
        sortColumn = orden;
        sortOrder = orden === 'created_at' ? 'DESC' : 'ASC';
      }
    }

    const sql = `
      SELECT *
      FROM equipos_completo
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null },
    };
  }

  async findById(id) {
    const result = await query(
      `SELECT * FROM equipos_completo WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const equipo = result.rows[0] || null;

    if (equipo) {
      // 1. Obtener historial de estado (últimos 10 cambios)
      const histResult = await query(
        `SELECT id, estado_anterior, estado_nuevo, motivo, cambiado_por, created_at as fecha
         FROM equipos_historial_estado
         WHERE equipo_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [id]
      );
      equipo.historial_estado = histResult.rows;

      // 2. Obtener últimas 5 OTs del equipo
      const otsResult = await query(
        `SELECT id, consecutivo, tipo_mantenimiento as tipo, estado, created_at as fecha, horometro_final
         FROM ordenes_trabajo
         WHERE equipo_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`,
        [id]
      );
      equipo.ultimas_ots = otsResult.rows;
    }

    return equipo;
  }

  async findBySerial(serial) {
    const result = await query(
      `SELECT id FROM equipos WHERE serial = $1 AND deleted_at IS NULL`,
      [serial]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const {
      marca,
      modelo,
      serial,
      motor,
      combustible,
      capacidad_carga,
      color,
      empresa_id,
      serie,
      tipo_equipo,
      capacidad_nominal,
      tipo_mastil,
      altura_maxima,
      tipo_propulsion,
      horometro_actual,
      odometro,
      ubicacion_fisica,
      ciudad_ubicacion,
      estado,
      motivo_estado,
      actualizado_por,
    } = data;

    // Si horometro_actual > 0, registrar fecha_horometro automáticamente
    const horometro = parseFloat(horometro_actual) || 0;
    const fecha_horometro = horoVal(horometro) > 0 ? new Date().toISOString().split('T')[0] : null;

    // Si odometro > 0, registrar fecha_odometro automáticamente
    const odo = parseFloat(odometro) || 0;
    const fecha_odometro = odo > 0 ? new Date().toISOString().split('T')[0] : null;

    const queryStr = `
      INSERT INTO equipos (
        marca, modelo, serial, motor, combustible, capacidad_carga, color, empresa_id,
        serie, tipo_equipo, capacidad_nominal, tipo_mastil, altura_maxima, tipo_propulsion,
        horometro_actual, odometro, fecha_horometro, fecha_odometro, ubicacion_fisica,
        ciudad_ubicacion, estado, motivo_estado, fecha_cambio_estado, actualizado_por,
        soat_vigente, soat_vencimiento
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      )
      RETURNING *
    `;

    const values = [
      marca,
      modelo,
      serial,
      motor,
      combustible,
      parseFloat(capacidad_carga) || null,
      color,
      empresa_id,
      serie,
      tipo_equipo,
      parseFloat(capacidad_nominal) || null,
      tipo_mastil || null,
      parseFloat(altura_maxima) || null,
      tipo_propulsion || null,
      horometro,
      odo,
      fecha_horometro,
      fecha_odometro,
      ubicacion_fisica,
      ciudad_ubicacion,
      estado || 'OPERATIVO',
      motivo_estado || null,
      estado ? new Date().toISOString().split('T')[0] : null,
      actualizado_por || null,
      data.soat_vigente ?? false,
      data.soat_vencimiento || null,
    ];

    const result = await query(queryStr, values);
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = [
      'marca', 'modelo', 'serial', 'motor', 'combustible', 'capacidad_carga', 'color', 'empresa_id',
      'serie', 'tipo_equipo', 'capacidad_nominal', 'tipo_mastil', 'altura_maxima', 'tipo_propulsion',
      'horometro_actual', 'odometro', 'fecha_horometro', 'fecha_odometro', 'ubicacion_fisica',
      'ciudad_ubicacion', 'estado', 'motivo_estado', 'fecha_cambio_estado', 'foto_path', 'foto_url',
      'foto_thumb_url', 'actualizado_por', 'soat_vigente', 'soat_vencimiento'
    ];

    // Obtener valores actuales para validación de fechas de actualización
    const currentRes = await query(`SELECT horometro_actual, odometro FROM equipos WHERE id = $1`, [id]);
    const current = currentRes.rows[0];

    for (const key of allowed) {
      if (key in data) {
        let val = data[key];

        // ── Sanitización universal: string vacío → null ──────────
        // Esto evita violaciones de CHECK constraints cuando el frontend
        // envía "" para campos opcionales como tipo_mastil, tipo_propulsion, etc.
        if (val === '') {
          val = null;
        }

        // Sanitizar campos numéricos: string vacío → null
        const numericFields = ['capacidad_carga', 'capacidad_nominal', 'altura_maxima'];
        if (numericFields.includes(key)) {
          val = val === '' || val === null || val === undefined ? null : parseFloat(val);
          if (val !== null && isNaN(val)) val = null;
        }

        // Manejar lógica de fechas de horómetro y odómetro
        if (key === 'horometro_actual') {
          val = val === '' || val === null || val === undefined ? 0 : parseFloat(val);
          if (!current || val !== parseFloat(current.horometro_actual)) {
            fields.push(`fecha_horometro = CURRENT_DATE`);
          }
        }
        if (key === 'odometro') {
          val = val === '' || val === null || val === undefined ? 0 : parseFloat(val);
          if (!current || val !== parseFloat(current.odometro)) {
            fields.push(`fecha_odometro = CURRENT_DATE`);
          }
        }

        fields.push(`${key} = $${i++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE equipos SET ${fields.join(', ')}, updated_at = NOW() 
       WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE equipos SET deleted_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByCompany(empresa_id, { estado, include_id } = {}) {
    let sql = `SELECT * FROM equipos_completo WHERE empresa_id = $1 AND deleted_at IS NULL`;
    const params = [empresa_id];
    let i = 2;
    if (estado) {
      if (include_id) {
        sql += ` AND (estado = $${i++} OR id = $${i++})`;
        params.push(estado.toUpperCase(), include_id);
      } else {
        sql += ` AND estado = $${i++}`;
        params.push(estado.toUpperCase());
      }
    }
    sql += ` ORDER BY created_at DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  async findStateHistory(equipoId, { limit = 20, offset = 0 } = {}) {
    const result = await query(
      `SELECT id, estado_anterior, estado_nuevo, motivo, cambiado_por, created_at as fecha
       FROM equipos_historial_estado
       WHERE equipo_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [equipoId, limit, offset]
    );
    const countRes = await query(
      `SELECT COUNT(*)::int as total FROM equipos_historial_estado WHERE equipo_id = $1`,
      [equipoId]
    );
    return {
      data: result.rows,
      total: countRes.rows[0].total,
    };
  }
}

function horoVal(val) {
  return typeof val === 'number' ? val : parseFloat(val) || 0;
}
