import { query, withTransaction } from '../../config/database.js';

export class ServiciosRepository {

  async findAll({ company_id, equipo_id, estado, fecha_desde, fecha_hasta, search, limit = 50, cursor }) {
    const conditions = ['(r.deleted_at IS NULL OR r.estado = \'ANULADO\')'];
    const params = [];
    let i = 1;

    if (company_id) { conditions.push(`r.company_id = $${i++}`); params.push(company_id); }
    if (equipo_id) { conditions.push(`r.equipo_id = $${i++}`); params.push(equipo_id); }
    if (estado && estado !== 'all') { conditions.push(`r.estado = $${i++}`); params.push(estado); }
    if (fecha_desde) { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(fecha_hasta); }
    if (search?.trim()) {
      conditions.push(`(r.numero_remision ILIKE $${i} OR c.name ILIKE $${i} OR e.serie ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`r.created_at < (SELECT created_at FROM remisiones WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);
    const sql = `
      SELECT r.*,
        c.name AS empresa_nombre, c.nit AS empresa_nit,
        e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.serial AS equipo_serial, e.serie AS equipo_serie,
        COALESCE(
          (
            SELECT string_agg(COALESCE(inv_sub.nombre_comercial, cs_sub.nombre), ' + ')
            FROM remision_servicios rs
            LEFT JOIN inventario inv_sub ON inv_sub.id = rs.catalogo_servicio_id
            LEFT JOIN catalogo_servicios cs_sub ON cs_sub.id = rs.catalogo_servicio_id
            WHERE rs.remision_id = r.id
          ),
          inv.nombre_comercial, 
          cs_old.nombre
        ) AS servicio_nombre,
        COALESCE(
          (
            SELECT string_agg(COALESCE(inv_sub.codigo_interno, cs_sub.codigo), ' + ')
            FROM remision_servicios rs
            LEFT JOIN inventario inv_sub ON inv_sub.id = rs.catalogo_servicio_id
            LEFT JOIN catalogo_servicios cs_sub ON cs_sub.id = rs.catalogo_servicio_id
            WHERE rs.remision_id = r.id
          ),
          inv.codigo_interno,   
          cs_old.codigo
        ) AS servicio_codigo
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN inventario inv     ON inv.id = r.catalogo_servicio_id
      LEFT JOIN catalogo_servicios cs_old ON cs_old.id = r.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findById(id) {
    const remRes = await query(`
      SELECT r.*,
        c.name AS empresa_nombre, c.nit AS empresa_nit,
        c.phone AS empresa_telefono, c.address AS empresa_direccion,
        c.phone_2 AS empresa_telefono2,
        e.marca AS equipo_marca, e.modelo AS equipo_modelo,
        e.serial AS equipo_serial, e.serie AS equipo_serie, e.capacidad_carga AS equipo_capacidad,
        e.bonificacion_hora AS equipo_bonificacion_hora,
        COALESCE(inv.nombre_comercial, cs_old.nombre)       AS servicio_nombre,
        COALESCE(inv.codigo_interno,   cs_old.codigo)        AS servicio_codigo,
        COALESCE(inv.descripcion_corta, cs_old.descripcion)  AS servicio_descripcion,
        COALESCE(inv.precio_servicio,  cs_old.precio_base)   AS servicio_precio_base,
        COALESCE(inv.tipo,             cs_old.tipo)          AS tipo,
        u.full_name AS creado_por_nombre
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN inventario inv     ON inv.id = r.catalogo_servicio_id
      LEFT JOIN catalogo_servicios cs_old ON cs_old.id = r.catalogo_servicio_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = $1 AND (r.deleted_at IS NULL OR r.estado = 'ANULADO')
    `, [id]);

    if (!remRes.rows[0]) return null;
    const rem = remRes.rows[0];

    const opRes = await query(`
      SELECT ro.id AS asignacion_id, ro.empleado_id,
             em.full_name, em.numero_documento AS identification, em.phone,
             em.position, em.monthly_salary
      FROM remision_operarios ro
      JOIN employees em ON em.id = ro.empleado_id
      WHERE ro.remision_id = $1
      ORDER BY em.full_name ASC
    `, [id]);
    rem.operarios = opRes.rows;

    const itemsRes = await query(`
      SELECT rs.id, rs.catalogo_servicio_id, rs.descripcion, rs.cantidad, rs.valor_unitario, rs.subtotal, rs.aplica_iva,
             COALESCE(inv.nombre_comercial, cs_old.nombre) AS servicio_nombre,
             COALESCE(inv.codigo_interno, cs_old.codigo) AS servicio_codigo,
             COALESCE(inv.unidad_cobro, inv.unit, cs_old.unidad, 'hora') AS unidad
      FROM remision_servicios rs
      LEFT JOIN inventario inv ON inv.id = rs.catalogo_servicio_id
      LEFT JOIN catalogo_servicios cs_old ON cs_old.id = rs.catalogo_servicio_id
      WHERE rs.remision_id = $1
      ORDER BY rs.orden ASC, rs.created_at ASC
    `, [id]);
    rem.items = itemsRes.rows;

    return rem;
  }

  async findLastFormaPago(company_id) {
    const res = await query(`
      SELECT forma_pago
      FROM remisiones
      WHERE company_id = $1
        AND estado IN ('REALIZADA', 'LIQUIDADA')
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [company_id]);
    return res.rows[0]?.forma_pago || null;
  }

  async findLastHorometro(equipo_id) {
    const res = await query(`
      SELECT horometro_regreso
      FROM remisiones
      WHERE equipo_id = $1
        AND estado IN ('REALIZADA', 'LIQUIDADA')
        AND horometro_regreso IS NOT NULL
        AND horometro_regreso > 0
        AND deleted_at IS NULL
      ORDER BY fecha_servicio DESC, created_at DESC
      LIMIT 1
    `, [equipo_id]);
    return res.rows[0]?.horometro_regreso || null;
  }

  async generarNumeroRemision(client) {
    const res = await client.query(`SELECT ultimo_valor FROM consecutivos WHERE id = 'REM' FOR UPDATE`);
    const current = res.rows[0]?.ultimo_valor || 32961;
    const next = current + 1;
    await client.query(
      `INSERT INTO consecutivos (id, ultimo_valor) VALUES ('REM', $1)
       ON CONFLICT (id) DO UPDATE SET ultimo_valor = EXCLUDED.ultimo_valor`,
      [next]
    );
    return String(next).padStart(5, '0');
  }

  async create(data, user) {
    const userId = user?.id;
    const userStr = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email : 'Sistema';
    return await withTransaction(async (client) => {
      const numero = await this.generarNumeroRemision(client);
      const d = data;

      const res = await client.query(`
        INSERT INTO remisiones (
          numero_remision, fecha_servicio, hora_acordada, forma_pago,
          company_id, catalogo_servicio_id, equipo_id,
          solicitado_por, solicitado_por_id, direccion_servicio, numero_maquina,
          hora_salida_cargar, hora_llegada_cliente, hora_salida_cliente, hora_llegada_cargar,
          segundo_hora_salida_cargar, segundo_hora_llegada_cliente, segundo_hora_salida_cliente, segundo_hora_llegada_cargar,
          segundo_horometro_salida, segundo_horometro_regreso,
          horometro_salida, horometro_regreso,
          cantidad_horas, valor_hora,
          horas_diurnas, valor_hora_diurna, horas_nocturnas, valor_hora_nocturna,
          horas_fest_diurnas, valor_hora_fest_dia, horas_fest_nocturnas, valor_hora_fest_noc,
          horas_otras, valor_hora_otras,
          horas_ordinarias, valor_hora_ordinaria, horas_recargo, valor_hora_recargo,
          total_bruto, iva_pct, iva_valor, descuentos, total_neto,
          observaciones, estado, created_by, bonificacion_hora
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48
        ) RETURNING *
      `, [
        numero,                                   // $1
        d.fecha_servicio,                         // $2
        d.hora_acordada || null,                  // $3
        d.forma_pago || 'Contado',                // $4
        d.company_id,                             // $5
        d.items && d.items.length > 0 ? d.items[0].catalogo_servicio_id : d.catalogo_servicio_id, // $6
        d.equipo_id || null,                              // $7
        d.solicitado_por || null,                 // $8
        d.solicitado_por_id || null,              // $9
        d.direccion_servicio || null,             // $10
        d.numero_maquina || null,                 // $11
        d.hora_salida_cargar || null,             // $12
        d.hora_llegada_cliente || null,           // $13
        d.hora_salida_cliente || null,            // $14
        d.hora_llegada_cargar || null,            // $15
        d.segundo_hora_salida_cargar || null,     // $16
        d.segundo_hora_llegada_cliente || null,   // $17
        d.segundo_hora_salida_cliente || null,    // $18
        d.segundo_hora_llegada_cargar || null,    // $19
        d.segundo_horometro_salida || null,       // $20
        d.segundo_horometro_regreso || null,      // $21
        d.horometro_salida || null,               // $22
        d.horometro_regreso || null,              // $23
        d.cantidad_horas || 0,                   // $24
        d.valor_hora || 0,                       // $25
        d.horas_diurnas || 0,                    // $26
        d.valor_hora_diurna || 0,               // $27
        d.horas_nocturnas || 0,                  // $28
        d.valor_hora_nocturna || 0,             // $29
        d.horas_fest_diurnas || 0,              // $30
        d.valor_hora_fest_dia || 0,             // $31
        d.horas_fest_nocturnas || 0,            // $32
        d.valor_hora_fest_noc || 0,             // $33
        d.horas_otras || 0,                     // $34
        d.valor_hora_otras || 0,               // $35
        d.horas_ordinarias || 0,               // $36
        d.valor_hora_ordinaria || 0,           // $37
        d.horas_recargo || 0,                  // $38
        d.valor_hora_recargo || 0,             // $39
        d.total_bruto || 0,                    // $40
        d.iva_pct || 19.00,                    // $41
        d.iva_valor || 0,                      // $42
        d.descuentos || 0,                     // $43
        d.total_neto || 0,                     // $44
        d.observaciones || null,               // $45
        d.estado || 'BORRADOR',                // $46
        userId,                                // $47
        d.bonificacion_hora || 0,              // $48
      ]);

      if (data.operario_id) {
        await client.query(
          `INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [res.rows[0].id, data.operario_id]
        );
      }
      if (data.operario_2_id) {
        await client.query(
          `INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [res.rows[0].id, data.operario_2_id]
        );
      }
      if (d.items && Array.isArray(d.items)) {
        let orden = 0;
        for (const item of d.items) {
          const cantidadRedondeada = Math.round((parseFloat(item.cantidad) || 1) * 100) / 100;
          await client.query(
            `INSERT INTO remision_servicios (remision_id, catalogo_servicio_id, descripcion, cantidad, valor_unitario, aplica_iva, orden)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [res.rows[0].id, item.catalogo_servicio_id, item.descripcion || null, cantidadRedondeada, item.valor_unitario || 0, item.aplica_iva || false, orden++]
          );
        }
      }

      if (d.equipo_id) {
        const eqRes = await client.query('SELECT estado FROM equipos WHERE id = $1', [d.equipo_id]);
        const estado_anterior = eqRes.rows[0]?.estado || 'OPERATIVO';

        if (estado_anterior !== 'ALQUILADO') {
          await client.query(
            `UPDATE equipos SET 
              estado = 'ALQUILADO',
              motivo_estado = $1,
              fecha_cambio_estado = CURRENT_DATE,
              actualizado_por = $2,
              updated_at = NOW()
             WHERE id = $3`,
            [`Alquilado automáticamente por creación de remisión ${numero}`, userStr, d.equipo_id]
          );

          await client.query(
            `INSERT INTO equipos_historial_estado (
              equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por
            ) VALUES ($1, $2, $3, $4, $5)`,
            [d.equipo_id, estado_anterior, 'ALQUILADO', `Alquilado por creación de remisión ${numero}`, userStr]
          );
        }
      }

      return res.rows[0];
    });
  }

  async update(id, data, user) {
    const userStr = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email : 'Sistema';
    return await withTransaction(async (client) => {
      // 1. Obtener estado y equipo actuales
      const currentRes = await client.query('SELECT equipo_id, estado, numero_remision FROM remisiones WHERE id = $1', [id]);
      const current = currentRes.rows[0];
      if (!current) return null;

      // 2. Construir y ejecutar la actualización de remisiones
      const fields = [];
      const values = [];
      let i = 1;
      const allowed = [
        'fecha_servicio', 'hora_acordada', 'forma_pago',
        'catalogo_servicio_id', 'equipo_id', 'solicitado_por', 'solicitado_por_id',
        'direccion_servicio', 'numero_maquina',
        'hora_salida_cargar', 'hora_llegada_cliente', 'hora_salida_cliente', 'hora_llegada_cargar',
        'segundo_fecha_acordada',
        'segundo_hora_salida_cargar', 'segundo_hora_llegada_cliente', 'segundo_hora_salida_cliente', 'segundo_hora_llegada_cargar', 'segundo_horometro_salida', 'segundo_horometro_regreso',
        'horometro_salida', 'horometro_regreso',
        'cantidad_horas', 'valor_hora',
        'horas_diurnas', 'valor_hora_diurna', 'horas_nocturnas', 'valor_hora_nocturna',
        'horas_fest_diurnas', 'valor_hora_fest_dia', 'horas_fest_nocturnas', 'valor_hora_fest_noc',
        'horas_otras', 'valor_hora_otras',
        'horas_ordinarias', 'valor_hora_ordinaria', 'horas_recargo', 'valor_hora_recargo',
        'total_bruto', 'iva_pct', 'iva_valor', 'descuentos', 'total_neto',
        'estado', 'observaciones', 'bonificacion_hora', 'is_servicio_fijo'
      ];
      for (const key of allowed) {
        if (key in data) {
          fields.push(`${key} = $${i++}`);
          let val = data[key];
          if (val === '') val = null;
          if (key === 'catalogo_servicio_id' && data.items && data.items.length > 0) {
            val = data.items[0].catalogo_servicio_id;
          }
          values.push(val);
        }
      }

      let updatedRem = null;
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(id);
        const result = await client.query(
          `UPDATE remisiones SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
          values
        );
        updatedRem = result.rows[0] || null;
      } else {
        const fetchUpdated = await client.query(`SELECT * FROM remisiones WHERE id = $1`, [id]);
        updatedRem = fetchUpdated.rows[0] || null;
      }

      if (!updatedRem) return null;

      if ('operario_id' in data || 'operario_2_id' in data) {
        await client.query(`DELETE FROM remision_operarios WHERE remision_id = $1`, [id]);
        if (data.operario_id) {
          await client.query(`INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, data.operario_id]);
        }
        if (data.operario_2_id) {
          await client.query(`INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, data.operario_2_id]);
        }
      }
      if (data.items && Array.isArray(data.items)) {
        await client.query(`DELETE FROM remision_servicios WHERE remision_id = $1`, [id]);
        let orden = 0;
        for (const item of data.items) {
          const cantidadRedondeada = Math.round((parseFloat(item.cantidad) || 1) * 100) / 100;
          await client.query(
            `INSERT INTO remision_servicios (remision_id, catalogo_servicio_id, descripcion, cantidad, valor_unitario, aplica_iva, orden)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, item.catalogo_servicio_id, item.descripcion || null, cantidadRedondeada, item.valor_unitario || 0, item.aplica_iva || false, orden++]
          );
        }
      }

      // 3. Lógica de transición de estado de equipos (orientada a estado objetivo)
      const old_equipo_id = current.equipo_id;
      const new_equipo_id = 'equipo_id' in data ? data.equipo_id : old_equipo_id;
      const old_estado = current.estado;
      const new_estado = 'estado' in data ? data.estado : old_estado;

      const is_released_state = ['LIQUIDADA', 'FACTURADA', 'ANULADO'].includes(new_estado);

      // A. Garantizar que el equipo actual esté en el estado correspondiente
      if (new_equipo_id) {
        const target_estado = is_released_state ? 'OPERATIVO' : 'ALQUILADO';
        const eqRes = await client.query('SELECT estado FROM equipos WHERE id = $1', [new_equipo_id]);
        const current_eq_state = eqRes.rows[0]?.estado;

        if (current_eq_state && current_eq_state !== target_estado) {
          // Si el estado objetivo es OPERATIVO, verificar que no haya otras remisiones activas del mismo equipo
          // para no liberar prematuramente un equipo con múltiples remisiones en curso
          let canReleaseEquipo = true;
          if (is_released_state) {
            const otrasActivasRes = await client.query(
              `SELECT COUNT(*) AS total
               FROM remisiones
               WHERE equipo_id = $1
                 AND id != $2
                 AND estado NOT IN ('LIQUIDADA', 'FACTURADA', 'ANULADO')
                 AND deleted_at IS NULL`,
              [new_equipo_id, id]
            );
            const otrasActivas = parseInt(otrasActivasRes.rows[0]?.total || 0);
            if (otrasActivas > 0) {
              canReleaseEquipo = false; // Hay otras remisiones activas → mantener ALQUILADO
            }
          }

          if (canReleaseEquipo) {
            const motivo = is_released_state
              ? `Liberado por estado ${new_estado} de remisión ${current.numero_remision}`
              : `Alquilado por remisión ${current.numero_remision} (Estado: ${new_estado})`;

            await client.query(
              `UPDATE equipos SET 
                estado = $1, 
                motivo_estado = $2, 
                fecha_cambio_estado = CURRENT_DATE, 
                actualizado_por = $3,
                updated_at = NOW()
               WHERE id = $4`,
              [target_estado, motivo, userStr, new_equipo_id]
            );

            await client.query(
              `INSERT INTO equipos_historial_estado (
                equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por
              ) VALUES ($1, $2, $3, $4, $5)`,
              [new_equipo_id, current_eq_state, target_estado, motivo, userStr]
            );
          }
        }
      }

      // B. Si el equipo cambió, liberar el equipo anterior
      if (old_equipo_id && new_equipo_id && old_equipo_id !== new_equipo_id) {
        const eqOldRes = await client.query('SELECT estado FROM equipos WHERE id = $1', [old_equipo_id]);
        const stateOld = eqOldRes.rows[0]?.estado;
        if (stateOld && stateOld !== 'OPERATIVO') {
          const motivo = `Liberado por cambio de equipo en remisión ${current.numero_remision}`;
          await client.query(
            `UPDATE equipos SET 
              estado = 'OPERATIVO',
              motivo_estado = $1,
              fecha_cambio_estado = CURRENT_DATE,
              actualizado_por = $2,
              updated_at = NOW()
             WHERE id = $3`,
            [motivo, userStr, old_equipo_id]
          );
          await client.query(
            `INSERT INTO equipos_historial_estado (
              equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por
            ) VALUES ($1, $2, $3, $4, $5)`,
            [old_equipo_id, stateOld, 'OPERATIVO', motivo, userStr]
          );
        }
      }

      return updatedRem;
    });
  }

  async softDelete(id, user) {
    const userStr = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email : 'Sistema';
    return await withTransaction(async (client) => {
      const currentRes = await client.query('SELECT equipo_id, estado, numero_remision FROM remisiones WHERE id = $1', [id]);
      const current = currentRes.rows[0];
      if (!current) return null;

      const result = await client.query(
        `UPDATE remisiones SET deleted_at = NOW(), estado = 'ANULADO' WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [id]
      );

      if (current.equipo_id && current.estado !== 'ANULADO') {
        const eqRes = await client.query('SELECT estado FROM equipos WHERE id = $1', [current.equipo_id]);
        const state = eqRes.rows[0]?.estado;
        if (state && state !== 'OPERATIVO') {
          // Verificar que no haya otras remisiones activas del mismo equipo antes de liberar
          const otrasActivasRes = await client.query(
            `SELECT COUNT(*) AS total
             FROM remisiones
             WHERE equipo_id = $1
               AND id != $2
               AND estado NOT IN ('LIQUIDADA', 'FACTURADA', 'ANULADO')
               AND deleted_at IS NULL`,
            [current.equipo_id, id]
          );
          const otrasActivas = parseInt(otrasActivasRes.rows[0]?.total || 0);

          if (otrasActivas === 0) {
            await client.query(
              `UPDATE equipos SET 
                estado = 'OPERATIVO',
                motivo_estado = $1,
                fecha_cambio_estado = CURRENT_DATE,
                actualizado_por = $2,
                updated_at = NOW()
               WHERE id = $3`,
              [`Liberado por anulación de remisión ${current.numero_remision}`, userStr, current.equipo_id]
            );
            await client.query(
              `INSERT INTO equipos_historial_estado (
                equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por
              ) VALUES ($1, $2, $3, $4, $5)`,
              [current.equipo_id, state, 'OPERATIVO', `Liberado por anulación de remisión ${current.numero_remision}`, userStr]
            );
          }
        }
      }

      return result.rows[0] || null;
    });
  }

  async addOperario(remision_id, empleado_id) {
    const res = await query(
      `INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2)
       ON CONFLICT (remision_id, empleado_id) DO NOTHING RETURNING *`,
      [remision_id, empleado_id]
    );
    return res.rows[0];
  }

  async removeOperario(remision_id, asignacion_id) {
    await query(
      `DELETE FROM remision_operarios WHERE id = $1 AND remision_id = $2`,
      [asignacion_id, remision_id]
    );
    return true;
  }

  async findOperariosDisponibles() {
    const res = await query(
      `SELECT id, full_name, numero_documento AS identification, phone, position, monthly_salary
       FROM employees
       WHERE LOWER(position) = 'operario' AND LOWER(status) = 'activo'
       ORDER BY full_name ASC`
    );
    return res.rows;
  }

  // ============================================================
  // LIQUIDACIÓN DE HORAS LABORALES
  // ============================================================

  async findHorasLaborales(remision_id) {
    const res = await query(
      `SELECT hl.*,
              em.full_name AS empleado_nombre,
              em.position  AS empleado_rol,
              em.monthly_salary AS empleado_salario_actual
       FROM remision_horas_laborales hl
       JOIN employees em ON em.id = hl.empleado_id
       WHERE hl.remision_id = $1
       ORDER BY hl.created_at ASC`,
      [remision_id]
    );
    return res.rows;
  }

  async upsertHorasLaborales(remision_id, payload) {
    const {
      empleado_id, fecha_trabajo, hora_entrada, hora_salida,
      salario_mensual, valor_hora_base,
      min_ord_diurna, min_ord_nocturna,
      min_extra_diurna, min_extra_nocturna,
      min_dom_diurna, min_dom_nocturna,
      min_extra_dom_diurna, min_extra_dom_nocturna,
      val_ord_diurna, val_ord_nocturna,
      val_extra_diurna, val_extra_nocturna,
      val_dom_diurna, val_dom_nocturna,
      val_extra_dom_diurna, val_extra_dom_nocturna,
      total_liquidado,
    } = payload;

    const res = await query(
      `INSERT INTO remision_horas_laborales (
         remision_id, empleado_id, fecha_trabajo, hora_entrada, hora_salida,
         salario_mensual, valor_hora_base,
         min_ord_diurna, min_ord_nocturna,
         min_extra_diurna, min_extra_nocturna,
         min_dom_diurna, min_dom_nocturna,
         min_extra_dom_diurna, min_extra_dom_nocturna,
         val_ord_diurna, val_ord_nocturna,
         val_extra_diurna, val_extra_nocturna,
         val_dom_diurna, val_dom_nocturna,
         val_extra_dom_diurna, val_extra_dom_nocturna,
         total_liquidado, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16,$17,$18,$19,$20,$21,$22,$23,$24, NOW()
       )
       ON CONFLICT (remision_id, empleado_id, fecha_trabajo)
       DO UPDATE SET
         hora_entrada           = EXCLUDED.hora_entrada,
         hora_salida            = EXCLUDED.hora_salida,
         salario_mensual        = EXCLUDED.salario_mensual,
         valor_hora_base        = EXCLUDED.valor_hora_base,
         min_ord_diurna         = EXCLUDED.min_ord_diurna,
         min_ord_nocturna       = EXCLUDED.min_ord_nocturna,
         min_extra_diurna       = EXCLUDED.min_extra_diurna,
         min_extra_nocturna     = EXCLUDED.min_extra_nocturna,
         min_dom_diurna         = EXCLUDED.min_dom_diurna,
         min_dom_nocturna       = EXCLUDED.min_dom_nocturna,
         min_extra_dom_diurna   = EXCLUDED.min_extra_dom_diurna,
         min_extra_dom_nocturna = EXCLUDED.min_extra_dom_nocturna,
         val_ord_diurna         = EXCLUDED.val_ord_diurna,
         val_ord_nocturna       = EXCLUDED.val_ord_nocturna,
         val_extra_diurna       = EXCLUDED.val_extra_diurna,
         val_extra_nocturna     = EXCLUDED.val_extra_nocturna,
         val_dom_diurna         = EXCLUDED.val_dom_diurna,
         val_dom_nocturna       = EXCLUDED.val_dom_nocturna,
         val_extra_dom_diurna   = EXCLUDED.val_extra_dom_diurna,
         val_extra_dom_nocturna = EXCLUDED.val_extra_dom_nocturna,
         total_liquidado        = EXCLUDED.total_liquidado,
         updated_at             = NOW()
       RETURNING *`,
      [
        remision_id, empleado_id, fecha_trabajo, hora_entrada, hora_salida,
        salario_mensual || 0, valor_hora_base || 0,
        min_ord_diurna || 0, min_ord_nocturna || 0,
        min_extra_diurna || 0, min_extra_nocturna || 0,
        min_dom_diurna || 0, min_dom_nocturna || 0,
        min_extra_dom_diurna || 0, min_extra_dom_nocturna || 0,
        val_ord_diurna || 0, val_ord_nocturna || 0,
        val_extra_diurna || 0, val_extra_nocturna || 0,
        val_dom_diurna || 0, val_dom_nocturna || 0,
        val_extra_dom_diurna || 0, val_extra_dom_nocturna || 0,
        total_liquidado || 0,
      ]
    );
    return res.rows[0];
  }

  async deleteHorasLaborales(remision_id, hid) {
    await query(
      `DELETE FROM remision_horas_laborales WHERE id = $1 AND remision_id = $2`,
      [hid, remision_id]
    );
    return true;
  }

  // ============================================================
  // REGISTRO DE DÍAS — SERVICIO FIJO
  // ============================================================

  /** Minutos de descuento fijos según el sistema */
  static calcMinutosDescuento(descDesayuno, descAlmuerzo) {
    return (descDesayuno ? 20 : 0) + (descAlmuerzo ? 30 : 0);
  }

  /** Horas brutas entre dos tiempos "HH:MM" — maneja cruce de medianoche */
  static calcHorasBrutas(entrada, salida) {
    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    let minBrutas = (sh * 60 + sm) - (eh * 60 + em);
    if (minBrutas < 0) minBrutas += 24 * 60; // cruce de medianoche
    return minBrutas / 60;
  }

  /** true si la fecha (YYYY-MM-DD) cae en el final de una quincena (día 15 o último del mes) */
  static esFechaLimiteQuincena(fechaStr) {
    const [, mes, dia] = fechaStr.split('-').map(Number);
    if (dia === 15) return true;
    const ultimoDia = new Date(new Date(fechaStr).getFullYear(), mes, 0).getDate();
    return dia === ultimoDia;
  }

  /** Partir un registro en dos si cruza medianoche Y esa medianoche es límite de quincena */
  static partirRegistroSiCruzaQuincena(fecha, entrada, salida, descDesayuno, descAlmuerzo, bonif) {
    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    const cruzaMedianoche = (sh * 60 + sm) < (eh * 60 + em);

    if (!cruzaMedianoche || !ServiciosRepository.esFechaLimiteQuincena(fecha)) {
      // Sin partición
      const minDesc = ServiciosRepository.calcMinutosDescuento(descDesayuno, descAlmuerzo);
      const brutas  = ServiciosRepository.calcHorasBrutas(entrada, salida);
      const netas   = Math.max(0, brutas - minDesc / 60);
      return [{ fecha, hora_entrada: entrada, hora_salida: salida,
                horas_brutas: brutas, minutos_descuento: minDesc,
                horas_netas: netas, descuento_desayuno: descDesayuno,
                descuento_almuerzo: descAlmuerzo,
                bonificacion_hora: bonif, comision: netas * bonif }];
    }

    // Parte 1: desde la entrada hasta "23:59" de fecha original
    const minParte1 = (23 * 60 + 59) - (eh * 60 + em) + 1; // hasta medianoche
    const horasParte1 = minParte1 / 60;
    const minDesc1 = ServiciosRepository.calcMinutosDescuento(descDesayuno, descAlmuerzo);
    const netas1 = Math.max(0, horasParte1 - minDesc1 / 60);

    // Parte 2: desde "00:00" hasta la hora de salida, día siguiente
    const fechaDate = new Date(fecha + 'T00:00:00');
    fechaDate.setDate(fechaDate.getDate() + 1);
    const fechaStr2 = fechaDate.toISOString().split('T')[0];
    const horasParte2 = (sh * 60 + sm) / 60;
    const netas2 = Math.max(0, horasParte2); // sin descuento en la segunda parte

    return [
      { fecha, hora_entrada: entrada, hora_salida: '23:59',
        horas_brutas: horasParte1, minutos_descuento: minDesc1,
        horas_netas: netas1, descuento_desayuno: descDesayuno,
        descuento_almuerzo: descAlmuerzo,
        bonificacion_hora: bonif, comision: netas1 * bonif },
      { fecha: fechaStr2, hora_entrada: '00:00', hora_salida: salida,
        horas_brutas: horasParte2, minutos_descuento: 0,
        horas_netas: netas2, descuento_desayuno: false,
        descuento_almuerzo: false,
        bonificacion_hora: bonif, comision: netas2 * bonif },
    ];
  }

  async findDiasFijo(remision_id) {
    const res = await query(
      `SELECT df.*,
              em.full_name       AS empleado_nombre,
              em.numero_documento AS empleado_cedula,
              em.position         AS empleado_rol
       FROM remision_dias_fijo df
       JOIN employees em ON em.id = df.empleado_id
       WHERE df.remision_id = $1
       ORDER BY df.fecha ASC, df.hora_entrada ASC`,
      [remision_id]
    );
    return res.rows;
  }

  /**
   * Inserta o reemplaza un día de servicio fijo.
   * Si cruza límite de quincena, crea 2 registros automáticamente.
   */
  async upsertDiaFijo(remision_id, payload) {
    const {
      empleado_id, fecha, hora_entrada, hora_salida,
      descuento_desayuno = true, descuento_almuerzo = false,
      bonificacion_hora = 0, notas = null,
    } = payload;

    const registros = ServiciosRepository.partirRegistroSiCruzaQuincena(
      fecha, hora_entrada, hora_salida,
      descuento_desayuno, descuento_almuerzo,
      parseFloat(bonificacion_hora)
    );

    const insertados = [];
    for (const reg of registros) {
      const r = await query(
        `INSERT INTO remision_dias_fijo
           (remision_id, empleado_id, fecha, hora_entrada, hora_salida,
            descuento_desayuno, descuento_almuerzo, minutos_descuento,
            horas_brutas, horas_netas, bonificacion_hora, comision, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (remision_id, empleado_id, fecha) DO UPDATE SET
           hora_entrada       = EXCLUDED.hora_entrada,
           hora_salida        = EXCLUDED.hora_salida,
           descuento_desayuno = EXCLUDED.descuento_desayuno,
           descuento_almuerzo = EXCLUDED.descuento_almuerzo,
           minutos_descuento  = EXCLUDED.minutos_descuento,
           horas_brutas       = EXCLUDED.horas_brutas,
           horas_netas        = EXCLUDED.horas_netas,
           bonificacion_hora  = EXCLUDED.bonificacion_hora,
           comision           = EXCLUDED.comision,
           notas              = EXCLUDED.notas,
           updated_at         = NOW()
         RETURNING *`,
        [
          remision_id, empleado_id, reg.fecha, reg.hora_entrada, reg.hora_salida,
          reg.descuento_desayuno, reg.descuento_almuerzo,
          reg.minutos_descuento,
          parseFloat(reg.horas_brutas.toFixed(2)),
          parseFloat(reg.horas_netas.toFixed(2)),
          parseFloat(reg.bonificacion_hora.toFixed(2)),
          parseFloat(reg.comision.toFixed(2)),
          notas,
        ]
      );
      insertados.push(r.rows[0]);
    }
    return insertados;
  }

  async deleteDiaFijo(remision_id, did) {
    await query(
      `DELETE FROM remision_dias_fijo WHERE id = $1 AND remision_id = $2`,
      [did, remision_id]
    );
    return true;
  }
}
