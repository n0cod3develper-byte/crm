import { query, withTransaction } from '../../config/database.js';

export class ServiciosRepository {

  async findAll({ company_id, equipo_id, estado, fecha_desde, fecha_hasta, search, limit = 50, cursor }) {
    const conditions = ['r.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (company_id) { conditions.push(`r.company_id = $${i++}`); params.push(company_id); }
    if (equipo_id)  { conditions.push(`r.equipo_id = $${i++}`);  params.push(equipo_id); }
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
        cs.nombre AS servicio_nombre, cs.codigo AS servicio_codigo
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN equipos e ON e.id = r.equipo_id
      JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
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
        cs.nombre AS servicio_nombre, cs.codigo AS servicio_codigo,
        cs.descripcion AS servicio_descripcion, cs.precio_base AS servicio_precio_base,
        u.full_name AS creado_por_nombre
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN equipos e ON e.id = r.equipo_id
      JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = $1 AND r.deleted_at IS NULL
    `, [id]);

    if (!remRes.rows[0]) return null;
    const rem = remRes.rows[0];

    const opRes = await query(`
      SELECT ro.id AS asignacion_id, ro.empleado_id, em.full_name, em.identification, em.phone
      FROM remision_operarios ro
      JOIN employees em ON em.id = ro.empleado_id
      WHERE ro.remision_id = $1
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

      const {
        fecha_servicio, hora_acordada, forma_pago,
        company_id, catalogo_servicio_id, equipo_id,
        solicitado_por, direccion_servicio, numero_maquina,
        hora_salida_cargar, hora_llegada_cliente, hora_salida_cliente, hora_llegada_cargar,
        horometro_salida, horometro_regreso,
        cantidad_horas, valor_hora,
        horas_diurnas, valor_hora_diurna,
        horas_nocturnas, valor_hora_nocturna,
        horas_fest_diurnas, valor_hora_fest_dia,
        horas_fest_nocturnas, valor_hora_fest_noc,
        horas_otras, valor_hora_otras,
        total_bruto, iva_pct, iva_valor, descuentos, total_neto,
        observaciones
      } = data;

      const res = await client.query(`
        INSERT INTO remisiones (
          numero_remision, fecha_servicio, hora_acordada, forma_pago,
          company_id, catalogo_servicio_id, equipo_id,
          solicitado_por, direccion_servicio, numero_maquina,
          hora_salida_cargar, hora_llegada_cliente, hora_salida_cliente, hora_llegada_cargar,
          horometro_salida, horometro_regreso,
          cantidad_horas, valor_hora,
          horas_diurnas, valor_hora_diurna, horas_nocturnas, valor_hora_nocturna,
          horas_fest_diurnas, valor_hora_fest_dia, horas_fest_nocturnas, valor_hora_fest_noc,
          horas_otras, valor_hora_otras,
          total_bruto, iva_pct, iva_valor, descuentos, total_neto,
          observaciones, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
        ) RETURNING *
      `, [
        numero, fecha_servicio, hora_acordada || null, forma_pago || 'Contado',
        company_id, catalogo_servicio_id, equipo_id,
        solicitado_por || null, direccion_servicio || null, numero_maquina || null,
        hora_salida_cargar || null, hora_llegada_cliente || null,
        hora_salida_cliente || null, hora_llegada_cargar || null,
        horometro_salida || null, horometro_regreso || null,
        cantidad_horas || 0, valor_hora || 0,
        horas_diurnas || 0, valor_hora_diurna || 0,
        horas_nocturnas || 0, valor_hora_nocturna || 0,
        horas_fest_diurnas || 0, valor_hora_fest_dia || 0,
        horas_fest_nocturnas || 0, valor_hora_fest_noc || 0,
        horas_otras || 0, valor_hora_otras || 0,
        total_bruto || 0, iva_pct || 19.00, iva_valor || 0, descuentos || 0, total_neto || 0,
        observaciones || null, userId
      ]);

      if (data.operario_id) {
        await client.query(
          `INSERT INTO remision_operarios (remision_id, empleado_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [res.rows[0].id, data.operario_id]
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
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await query(
      `UPDATE remisiones SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
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
      `SELECT id, full_name, identification, phone
       FROM employees
       WHERE LOWER(position) = 'operario' AND LOWER(status) = 'activo'
       ORDER BY full_name ASC`
    );
    return res.rows;
  }
}
