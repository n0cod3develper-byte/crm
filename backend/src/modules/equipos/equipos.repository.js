import { query, withTransaction } from '../../config/database.js';

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
      // 3. Obtener repuestos compatibles
      const repsResult = await query(
        `SELECT aceite_motor, filtro_glp, filtro_aire, lubricante_cadena, grasa,
                filtro_combustible, filtro_motor, filtro_bomba_gasolina
         FROM equipos_repuestos_compatibles
         WHERE equipo_id = $1`,
        [id]
      );
      equipo.repuestos_compatibles = repsResult.rows[0] || {};
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
    return await withTransaction(async (client) => {
      let centro_costo_id = null;
      if (data.centro_costo_nombre) {
        const ccRes = await client.query(
          'SELECT id FROM centros_costos WHERE empresa_id = $1 AND nombre ILIKE $2',
          [data.empresa_id, data.centro_costo_nombre]
        );
        if (ccRes.rows.length > 0) {
          centro_costo_id = ccRes.rows[0].id;
        } else {
          const insertCc = await client.query(
            'INSERT INTO centros_costos (empresa_id, nombre) VALUES ($1, $2) RETURNING id',
            [data.empresa_id, data.centro_costo_nombre]
          );
          centro_costo_id = insertCc.rows[0].id;
        }
      }

      const {
        marca, modelo, serial, motor, combustible, capacidad_carga, color, empresa_id,
        serie, tipo_equipo, capacidad_nominal, tipo_mastil, altura_maxima, tipo_propulsion,
        horometro_actual, odometro, ubicacion_fisica, ciudad_ubicacion, estado, motivo_estado,
        actualizado_por, bonificacion_hora, repuestos_compatibles
      } = data;

      const horometro = parseFloat(horometro_actual) || 0;
      const fecha_horometro = horoVal(horometro) > 0 ? new Date().toISOString().split('T')[0] : null;

      const odo = parseFloat(odometro) || 0;
      const fecha_odometro = odo > 0 ? new Date().toISOString().split('T')[0] : null;

      const queryStr = `
        INSERT INTO equipos (
          marca, modelo, serial, motor, combustible, capacidad_carga, color, empresa_id,
          serie, tipo_equipo, capacidad_nominal, tipo_mastil, altura_maxima, tipo_propulsion,
          horometro_actual, odometro, fecha_horometro, fecha_odometro, ubicacion_fisica,
          ciudad_ubicacion, estado, motivo_estado, fecha_cambio_estado, actualizado_por,
          soat_vigente, soat_vencimiento, bonificacion_hora, centro_costo_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
        RETURNING *
      `;

      const values = [
        marca, modelo, serial, motor, combustible, parseFloat(capacidad_carga) || null, color, empresa_id,
        serie, tipo_equipo, parseFloat(capacidad_nominal) || null, tipo_mastil || null, parseFloat(altura_maxima) || null, tipo_propulsion || null,
        horometro, odo, fecha_horometro, fecha_odometro, ubicacion_fisica, ciudad_ubicacion,
        estado || 'OPERATIVO', motivo_estado || null, estado ? new Date().toISOString().split('T')[0] : null,
        actualizado_por || null, data.soat_vigente ?? false, data.soat_vencimiento || null,
        parseFloat(bonificacion_hora) || 0, centro_costo_id || null,
      ];

      const result = await client.query(queryStr, values);
      const equipo = result.rows[0];

      if (repuestos_compatibles) {
        await client.query(`
          INSERT INTO equipos_repuestos_compatibles (
            equipo_id, aceite_motor, filtro_glp, filtro_aire, lubricante_cadena, grasa,
            filtro_combustible, filtro_motor, filtro_bomba_gasolina
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          equipo.id,
          repuestos_compatibles.aceite_motor || null, repuestos_compatibles.filtro_glp || null,
          repuestos_compatibles.filtro_aire || null, repuestos_compatibles.lubricante_cadena || null,
          repuestos_compatibles.grasa || null, repuestos_compatibles.filtro_combustible || null,
          repuestos_compatibles.filtro_motor || null, repuestos_compatibles.filtro_bomba_gasolina || null
        ]);
      }

      return equipo;
    });
  }

  async update(id, data) {
    return await withTransaction(async (client) => {
      let centro_costo_id = undefined;
      
      if (data.empresa_id && data.centro_costo_nombre) {
        const ccRes = await client.query(
          'SELECT id FROM centros_costos WHERE empresa_id = $1 AND nombre ILIKE $2',
          [data.empresa_id, data.centro_costo_nombre]
        );
        if (ccRes.rows.length > 0) {
          centro_costo_id = ccRes.rows[0].id;
        } else {
          const insertCc = await client.query(
            'INSERT INTO centros_costos (empresa_id, nombre) VALUES ($1, $2) RETURNING id',
            [data.empresa_id, data.centro_costo_nombre]
          );
          centro_costo_id = insertCc.rows[0].id;
        }
      }

      const fields = [];
      const values = [];
      let i = 1;

      const allowed = [
        'marca', 'modelo', 'serial', 'motor', 'combustible', 'capacidad_carga', 'color', 'empresa_id',
        'serie', 'tipo_equipo', 'capacidad_nominal', 'tipo_mastil', 'altura_maxima', 'tipo_propulsion',
        'horometro_actual', 'odometro', 'fecha_horometro', 'fecha_odometro', 'ubicacion_fisica',
        'ciudad_ubicacion', 'estado', 'motivo_estado', 'fecha_cambio_estado', 'foto_path', 'foto_url',
        'foto_thumb_url', 'actualizado_por', 'soat_vigente', 'soat_vencimiento', 'bonificacion_hora'
      ];

      const currentRes = await client.query(`SELECT horometro_actual, odometro FROM equipos WHERE id = $1`, [id]);
      const current = currentRes.rows[0];

      for (const key of allowed) {
        if (key in data) {
          let val = data[key];

          if (val === '') {
            val = null;
          }

          const numericFields = ['capacidad_carga', 'capacidad_nominal', 'altura_maxima', 'bonificacion_hora'];
          if (numericFields.includes(key)) {
            val = val === '' || val === null || val === undefined ? null : parseFloat(val);
            if (val !== null && isNaN(val)) val = null;
          }

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

      if (centro_costo_id !== undefined) {
        fields.push(`centro_costo_id = $${i++}`);
        values.push(centro_costo_id);
      }

      let equipo;
      if (fields.length > 0) {
        values.push(id);
        const result = await client.query(
          `UPDATE equipos SET ${fields.join(', ')}, updated_at = NOW() 
           WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
          values
        );
        equipo = result.rows[0] || null;
      } else {
        const result = await client.query(`SELECT * FROM equipos WHERE id = $1`, [id]);
        equipo = result.rows[0] || null;
      }

      // Update repuestos
      if (data.repuestos_compatibles) {
        const rc = data.repuestos_compatibles;
        await client.query(`
          INSERT INTO equipos_repuestos_compatibles (
            equipo_id, aceite_motor, filtro_glp, filtro_aire, lubricante_cadena, grasa,
            filtro_combustible, filtro_motor, filtro_bomba_gasolina
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (equipo_id) DO UPDATE SET
            aceite_motor = EXCLUDED.aceite_motor,
            filtro_glp = EXCLUDED.filtro_glp,
            filtro_aire = EXCLUDED.filtro_aire,
            lubricante_cadena = EXCLUDED.lubricante_cadena,
            grasa = EXCLUDED.grasa,
            filtro_combustible = EXCLUDED.filtro_combustible,
            filtro_motor = EXCLUDED.filtro_motor,
            filtro_bomba_gasolina = EXCLUDED.filtro_bomba_gasolina,
            updated_at = NOW()
        `, [
          id,
          rc.aceite_motor || null, rc.filtro_glp || null, rc.filtro_aire || null,
          rc.lubricante_cadena || null, rc.grasa || null, rc.filtro_combustible || null,
          rc.filtro_motor || null, rc.filtro_bomba_gasolina || null
        ]);
      }

      return this.findById(id);
    });
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE equipos SET deleted_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByCompany(empresa_id, { estado, include_id } = {}) {
    let targetEmpresaId = empresa_id;
    if (typeof empresa_id === 'string' && (empresa_id.toLowerCase() === 'cargar' || empresa_id.toLowerCase() === 'cargar s.a.s' || empresa_id.toLowerCase() === 'cargar s.a.s.')) {
      const resEmp = await query(`SELECT id FROM companies WHERE name ILIKE 'CARGAR%' LIMIT 1`);
      if (resEmp.rows.length > 0) {
        targetEmpresaId = resEmp.rows[0].id;
      }
    }

    // Validar que targetEmpresaId sea un UUID válido antes de continuar.
    // Esto previene que PostgreSQL lance un error de sintaxis de tipo UUID (500 Internal Server Error)
    // en caso de que la empresa 'CARGAR' no exista en la base de datos de producción.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetEmpresaId)) {
      return [];
    }

    let sql = `SELECT * FROM equipos_completo WHERE empresa_id = $1 AND deleted_at IS NULL`;
    const params = [targetEmpresaId];
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

  async findExternos({ search, estado, include_id } = {}) {
    // Buscar equipos de todas las empresas excepto CARGAR S.A.S.
    let sql = `
      SELECT * FROM equipos_completo 
      WHERE empresa_id != (SELECT id FROM companies WHERE name ILIKE 'CARGAR%' LIMIT 1)
        AND deleted_at IS NULL
    `;
    const params = [];
    let i = 1;

    if (search && search.trim() !== '') {
      sql += ` AND (marca ILIKE $${i} OR serie ILIKE $${i} OR serial ILIKE $${i} OR empresa_nombre ILIKE $${i})`;
      params.push(`%${search.trim()}%`);
      i++;
    }

    if (estado) {
      if (include_id) {
        sql += ` AND (estado = $${i++} OR id = $${i++})`;
        params.push(estado.toUpperCase(), include_id);
      } else {
        sql += ` AND estado = $${i++}`;
        params.push(estado.toUpperCase());
      }
    }

    sql += ` ORDER BY empresa_nombre ASC, marca ASC LIMIT 50`;
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

  /**
   * Reparación: libera todos los equipos en estado ALQUILADO
   * que no tienen ninguna remisión activa (BORRADOR o PENDIENTE).
   * Devuelve la lista de equipos corregidos.
   */
  async repairEstadosAlquilado(userStr = 'Sistema') {
    return await withTransaction(async (client) => {
      const atascadosRes = await client.query(`
        SELECT e.id, e.marca, e.modelo, e.serial, e.serie
        FROM equipos e
        WHERE e.estado = 'ALQUILADO'
          AND e.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM remisiones r
            WHERE r.equipo_id = e.id
              AND r.deleted_at IS NULL
              AND r.estado IN ('PENDIENTE', 'EN_PROCESO')
          )
      `);

      const liberados = [];
      for (const eq of atascadosRes.rows) {
        const motivo = 'Liberado automáticamente: sin remisiones activas (reparación de estado)';
        await client.query(
          `UPDATE equipos SET
             estado = 'OPERATIVO',
             motivo_estado = $1,
             fecha_cambio_estado = CURRENT_DATE,
             actualizado_por = $2,
             updated_at = NOW()
           WHERE id = $3`,
          [motivo, userStr, eq.id]
        );
        await client.query(
          `INSERT INTO equipos_historial_estado
             (equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por)
           VALUES ($1, 'ALQUILADO', 'OPERATIVO', $2, $3)`,
          [eq.id, motivo, userStr]
        );
        liberados.push(eq);
      }
      return liberados;
    });
  }
  // ─── Detail Page: OTs by equipo ─────────────────────────
  async findDetailOTs(equipoId, { tipo_mantenimiento, fecha_desde, fecha_hasta, search, limit = 50, cursor }) {
    const conditions = ['ot.equipo_id = $1', 'ot.deleted_at IS NULL'];
    const params = [equipoId];
    let i = 2;

    if (tipo_mantenimiento && tipo_mantenimiento !== 'all') {
      conditions.push(`ot.tipo_mantenimiento = $${i++}`);
      params.push(tipo_mantenimiento);
    }
    if (fecha_desde) { conditions.push(`ot.created_at >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`ot.created_at <= ($${i++}::date + INTERVAL '1 day')`); params.push(fecha_hasta); }
    if (search?.trim()) {
      conditions.push(`(ot.consecutivo ILIKE $${i} OR ot.detalle_servicio ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`ot.created_at < (SELECT created_at FROM ordenes_trabajo WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);
    const sql = `
      SELECT ot.id, ot.consecutivo, ot.tipo_mantenimiento, ot.estado,
             ot.detalle_servicio, ot.horometro_inicial, ot.horometro_final,
             ot.fecha_hora_ingreso_taller, ot.fecha_hora_salida_taller,
             ot.created_at, ot.fallas_encontradas, ot.nivel_criticidad,
             c.name AS empresa_nombre,
             COALESCE(
               (SELECT string_agg(em.full_name, ', ')
                FROM ot_tecnicos t JOIN employees em ON em.id = t.empleado_id
                WHERE t.orden_trabajo_id = ot.id), '—'
             ) AS tecnicos,
             (SELECT json_agg(json_build_object(
               'id', a.id, 'descripcion', a.descripcion, 'estado', a.estado, 'observaciones', a.observaciones
             )) FROM ot_actividades a WHERE a.orden_trabajo_id = ot.id) AS actividades,
             (SELECT json_agg(json_build_object(
               'id', ri.id, 'descripcion', ri.descripcion, 'cantidad', ri.cantidad,
               'precio_unitario', ri.precio_unitario, 'total', ri.total
             )) FROM ot_repuestos_insumos ri WHERE ri.orden_trabajo_id = ot.id) AS repuestos,
             (SELECT total_final FROM ot_liquidacion WHERE orden_trabajo_id = ot.id) AS costo_total
      FROM ordenes_trabajo ot
      LEFT JOIN companies c ON c.id = ot.empresa_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ot.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  // ─── Detail Page: Remisiones by equipo ──────────────────
  async findDetailRemisiones(equipoId, { estado, fecha_desde, fecha_hasta, search, limit = 50, cursor }) {
    const conditions = ['r.equipo_id = $1', '(r.deleted_at IS NULL OR r.estado = \'ANULADO\')'];
    const params = [equipoId];
    let i = 2;

    if (estado && estado !== 'all') { conditions.push(`r.estado = $${i++}`); params.push(estado); }
    if (fecha_desde) { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(fecha_hasta); }
    if (search?.trim()) {
      conditions.push(`(r.numero_remision ILIKE $${i} OR c.name ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`r.created_at < (SELECT created_at FROM remisiones WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);
    const sql = `
      SELECT r.id, r.numero_remision, r.fecha_servicio, r.estado,
             r.cantidad_horas, r.total_neto, r.observaciones,
             r.hora_salida_cargar, r.hora_llegada_cargar,
             c.name AS empresa_nombre,
             COALESCE(
               (SELECT string_agg(em.full_name, ', ')
                FROM remision_operarios ro JOIN employees em ON em.id = ro.empleado_id
                WHERE ro.remision_id = r.id), '—'
             ) AS operarios,
             COALESCE(
               (SELECT string_agg(COALESCE(inv.nombre_comercial, cs.nombre), ' + ')
                FROM remision_servicios rs
                LEFT JOIN inventario inv ON inv.id = rs.catalogo_servicio_id
                LEFT JOIN catalogo_servicios cs ON cs.id = rs.catalogo_servicio_id
                WHERE rs.remision_id = r.id),
               '—'
             ) AS servicio_nombre
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  // ─── Detail Page: Tiempos calculados ────────────────────
  async findTiempos(equipoId) {
    // 1. Tiempo en taller: sum de (salida - ingreso) para OTs con ambos campos
    const tallerRes = await query(`
      SELECT
        COUNT(*)::int AS total_ots_taller,
        COALESCE(SUM(EXTRACT(EPOCH FROM (fecha_hora_salida_taller - fecha_hora_ingreso_taller)) / 3600), 0) AS horas_taller
      FROM ordenes_trabajo
      WHERE equipo_id = $1
        AND deleted_at IS NULL
        AND fecha_hora_ingreso_taller IS NOT NULL
        AND fecha_hora_salida_taller IS NOT NULL
    `, [equipoId]);

    // 2. Detalle por OT
    const tallerDetRes = await query(`
      SELECT id, consecutivo, tipo_mantenimiento, estado,
             fecha_hora_ingreso_taller, fecha_hora_salida_taller,
             EXTRACT(EPOCH FROM (fecha_hora_salida_taller - fecha_hora_ingreso_taller)) / 3600 AS horas
      FROM ordenes_trabajo
      WHERE equipo_id = $1
        AND deleted_at IS NULL
        AND fecha_hora_ingreso_taller IS NOT NULL
        AND fecha_hora_salida_taller IS NOT NULL
      ORDER BY fecha_hora_ingreso_taller DESC
    `, [equipoId]);

    // 3. Tiempo alquilado: sum de cantidad_horas de remisiones
    const alquiladoRes = await query(`
      SELECT
        COUNT(*)::int AS total_remisiones,
        COALESCE(SUM(cantidad_horas), 0) AS horas_alquilado
      FROM remisiones
      WHERE equipo_id = $1
        AND deleted_at IS NULL
        AND estado IN ('REALIZADA', 'LIQUIDADA', 'FACTURADA')
        AND cantidad_horas IS NOT NULL
        AND cantidad_horas > 0
    `, [equipoId]);

    // 4. Detalle por remisión
    const alquiladoDetRes = await query(`
      SELECT r.id, r.numero_remision, r.fecha_servicio, r.estado,
             r.cantidad_horas, c.name AS empresa_nombre
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      WHERE r.equipo_id = $1
        AND r.deleted_at IS NULL
        AND r.estado IN ('REALIZADA', 'LIQUIDADA', 'FACTURADA')
        AND r.cantidad_horas IS NOT NULL
        AND r.cantidad_horas > 0
      ORDER BY r.fecha_servicio DESC
    `, [equipoId]);

    return {
      taller: {
        total_ots: tallerRes.rows[0].total_ots_taller,
        horas: parseFloat(parseFloat(tallerRes.rows[0].horas_taller).toFixed(2)),
        detalle: tallerDetRes.rows.map(r => ({ ...r, horas: parseFloat(parseFloat(r.horas).toFixed(2)) })),
      },
      alquilado: {
        total_remisiones: alquiladoRes.rows[0].total_remisiones,
        horas: parseFloat(parseFloat(alquiladoRes.rows[0].horas_alquilado).toFixed(2)),
        detalle: alquiladoDetRes.rows,
      },
    };
  }
}

function horoVal(val) {
  return typeof val === 'number' ? val : parseFloat(val) || 0;
}
