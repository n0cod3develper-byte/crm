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
      SELECT r.*,
        c.name AS empresa_nombre, c.nit AS empresa_nit,
        e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.serial AS equipo_serial,
        COALESCE(inv.nombre_comercial, cs_old.nombre) AS servicio_nombre,
        COALESCE(inv.codigo_interno,   cs_old.codigo)  AS servicio_codigo
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN equipos e ON e.id = r.equipo_id
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
        e.serial AS equipo_serial, e.capacidad_carga AS equipo_capacidad,
        COALESCE(inv.nombre_comercial, cs_old.nombre)       AS servicio_nombre,
        COALESCE(inv.codigo_interno,   cs_old.codigo)        AS servicio_codigo,
        COALESCE(inv.descripcion_corta, cs_old.descripcion)  AS servicio_descripcion,
        COALESCE(inv.precio_servicio,  cs_old.precio_base)   AS servicio_precio_base,
        COALESCE(inv.tipo,             cs_old.tipo)          AS tipo,
        u.full_name AS creado_por_nombre
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN inventario inv     ON inv.id = r.catalogo_servicio_id
      LEFT JOIN catalogo_servicios cs_old ON cs_old.id = r.catalogo_servicio_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = $1 AND (r.deleted_at IS NULL OR r.estado = 'ANULADO')
    `, [id]);

    if (!remRes.rows[0]) return null;
    const rem = remRes.rows[0];

    const opRes = await query(`
      SELECT ro.id AS asignacion_id, ro.empleado_id,
             em.full_name, em.identification, em.phone,
             em.position, em.monthly_salary
      FROM remision_operarios ro
      JOIN employees em ON em.id = ro.empleado_id
      WHERE ro.remision_id = $1
      ORDER BY em.full_name ASC
    `, [id]);
    rem.operarios = opRes.rows;

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

  async create(data, userId) {
    return await withTransaction(async (client) => {
      const numero = await this.generarNumeroRemision(client);
      const d = data;

      const res = await client.query(`
        INSERT INTO remisiones (
          numero_remision, fecha_servicio, hora_acordada, forma_pago,
          company_id, catalogo_servicio_id, equipo_id,
          solicitado_por, direccion_servicio, numero_maquina,
          hora_salida_cargar, hora_llegada_cliente, hora_salida_cliente, hora_llegada_cargar,
          segundo_hora_salida_cargar, segundo_hora_llegada_cliente, segundo_hora_salida_cliente, segundo_hora_llegada_cargar,
          segundo_horometro_salida, segundo_horometro_regreso,
          horometro_salida, horometro_regreso,
          cantidad_horas, valor_hora,
          horas_diurnas, valor_hora_diurna, horas_nocturnas, valor_hora_nocturna,
          horas_fest_diurnas, valor_hora_fest_dia, horas_fest_nocturnas, valor_hora_fest_noc,
          horas_otras, valor_hora_otras,
          total_bruto, iva_pct, iva_valor, descuentos, total_neto,
          observaciones, estado, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42
        ) RETURNING *
      `, [
        numero,                                   // $1
        d.fecha_servicio,                         // $2
        d.hora_acordada || null,                  // $3
        d.forma_pago || 'Contado',                // $4
        d.company_id,                             // $5
        d.catalogo_servicio_id,                   // $6
        d.equipo_id,                              // $7
        d.solicitado_por || null,                 // $8
        d.direccion_servicio || null,             // $9
        d.numero_maquina || null,                 // $10
        d.hora_salida_cargar || null,             // $11
        d.hora_llegada_cliente || null,           // $12
        d.hora_salida_cliente || null,            // $13
        d.hora_llegada_cargar || null,            // $14
        d.segundo_hora_salida_cargar || null,     // $15
        d.segundo_hora_llegada_cliente || null,   // $16
        d.segundo_hora_salida_cliente || null,    // $17
        d.segundo_hora_llegada_cargar || null,    // $18
        d.segundo_horometro_salida || null,       // $19
        d.segundo_horometro_regreso || null,      // $20
        d.horometro_salida || null,               // $21
        d.horometro_regreso || null,              // $22
        d.cantidad_horas || 0,                   // $23
        d.valor_hora || 0,                       // $24
        d.horas_diurnas || 0,                    // $25
        d.valor_hora_diurna || 0,               // $26
        d.horas_nocturnas || 0,                  // $27
        d.valor_hora_nocturna || 0,             // $28
        d.horas_fest_diurnas || 0,              // $29
        d.valor_hora_fest_dia || 0,             // $30
        d.horas_fest_nocturnas || 0,            // $31
        d.valor_hora_fest_noc || 0,             // $32
        d.horas_otras || 0,                     // $33
        d.valor_hora_otras || 0,               // $34
        d.total_bruto || 0,                    // $35
        d.iva_pct || 19.00,                    // $36
        d.iva_valor || 0,                      // $37
        d.descuentos || 0,                     // $38
        d.total_neto || 0,                     // $39
        d.observaciones || null,               // $40
        d.estado || 'BORRADOR',                // $41
        userId,                                // $42
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

      return res.rows[0];
    });
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = [
      'fecha_servicio', 'hora_acordada', 'forma_pago',
      'catalogo_servicio_id', 'equipo_id', 'solicitado_por',
      'direccion_servicio', 'numero_maquina',
      'hora_salida_cargar', 'hora_llegada_cliente', 'hora_salida_cliente', 'hora_llegada_cargar',
      'segundo_fecha_acordada',
      'segundo_hora_salida_cargar', 'segundo_hora_llegada_cliente', 'segundo_hora_salida_cliente', 'segundo_hora_llegada_cargar', 'segundo_horometro_salida', 'segundo_horometro_regreso',
      'horometro_salida', 'horometro_regreso',
      'cantidad_horas', 'valor_hora',
      'horas_diurnas', 'valor_hora_diurna', 'horas_nocturnas', 'valor_hora_nocturna',
      'horas_fest_diurnas', 'valor_hora_fest_dia', 'horas_fest_nocturnas', 'valor_hora_fest_noc',
      'horas_otras', 'valor_hora_otras',
      'total_bruto', 'iva_pct', 'iva_valor', 'descuentos', 'total_neto',
      'estado', 'observaciones'
    ];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        let val = data[key];
        if (val === '') val = null;
        values.push(val);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE remisiones SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );

    if ('operario_id' in data || 'operario_2_id' in data) {
      await query(`DELETE FROM remision_operarios WHERE remision_id = $1`, [id]);
      if (data.operario_id) {
        await query(`INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, data.operario_id]);
      }
      if (data.operario_2_id) {
        await query(`INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, data.operario_2_id]);
      }
    }

    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE remisiones SET deleted_at = NOW(), estado = 'ANULADO' WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
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
      `SELECT id, full_name, identification, phone, position, monthly_salary
       FROM employees
       WHERE LOWER(position) IN ('operario', 'técnico', 'tecnico') AND LOWER(status) = 'activo'
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
}
