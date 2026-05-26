import { query } from '../../config/database.js';

export class InformesRepository {

  // ============================================================
  // SUBMÓDULO 1: TOTALIZADO FINAL
  // ============================================================

  async getTotalizadoFinal({
    fecha_desde, fecha_hasta, company_id, operario_id,
    equipo_id, estado, tipo_servicio, ciudad,
    horas_min, horas_max, facturacion_min, facturacion_max,
    search, limit = 100, offset = 0,
  }) {
    const conditions = ['r.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_desde)      { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta)      { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(fecha_hasta); }
    if (company_id)       { conditions.push(`r.company_id = $${i++}`); params.push(company_id); }
    if (equipo_id)        { conditions.push(`r.equipo_id = $${i++}`); params.push(equipo_id); }
    if (estado && estado !== 'all') { conditions.push(`r.estado = $${i++}`); params.push(estado); }
    if (tipo_servicio && tipo_servicio !== 'all') {
      conditions.push(`cs.tipo = $${i++}`); params.push(tipo_servicio);
    }
    if (ciudad)           { conditions.push(`c.city ILIKE $${i++}`); params.push(`%${ciudad}%`); }
    if (horas_min)        { conditions.push(`r.cantidad_horas >= $${i++}`); params.push(parseFloat(horas_min)); }
    if (horas_max)        { conditions.push(`r.cantidad_horas <= $${i++}`); params.push(parseFloat(horas_max)); }
    if (facturacion_min)  { conditions.push(`r.total_neto >= $${i++}`); params.push(parseFloat(facturacion_min)); }
    if (facturacion_max)  { conditions.push(`r.total_neto <= $${i++}`); params.push(parseFloat(facturacion_max)); }
    if (search?.trim()) {
      conditions.push(`(r.numero_remision ILIKE $${i} OR c.name ILIKE $${i} OR c.nit ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (operario_id) {
      conditions.push(`EXISTS (
        SELECT 1 FROM remision_operarios ro2
        WHERE ro2.remision_id = r.id AND ro2.empleado_id = $${i++}
      )`);
      params.push(operario_id);
    }

    // Total count
    const countSql = `
      SELECT COUNT(*) AS total
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await query(countSql, params);
    const totalRegistros = parseInt(countResult.rows[0]?.total || 0);

    // KPIs
    const kpiSql = `
      SELECT
        COUNT(*) AS total_servicios,
        COALESCE(SUM(r.total_neto), 0) AS total_facturado,
        COALESCE(SUM(r.cantidad_horas), 0) AS total_horas,
        COALESCE(SUM(r.descuentos), 0) AS total_descuentos,
        COALESCE(SUM(r.total_neto), 0) AS total_neto
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
    `;
    const kpiResult = await query(kpiSql, params);
    const kpis = kpiResult.rows[0];

    // Data paginada
    params.push(limit);
    params.push(offset);
    const dataSql = `
      SELECT
        r.id,
        cs.tipo                           AS tipo,
        e.capacidad_carga                 AS toneladas,
        r.numero_remision,
        cs.codigo                         AS servicio_codigo,
        cs.nombre                         AS servicio_nombre,
        r.forma_pago,
        r.fecha_servicio,
        r.fecha_factura,
        r.numero_factura,
        r.estado,
        c.name                            AS empresa_nombre,
        c.nit,
        c.email,
        c.phone                           AS telefono,
        c.address                         AS direccion,
        c.city                            AS ciudad_envio,
        e.numero_equipo                   AS maquina,
        r.cantidad_horas,
        r.valor_hora,
        r.total_bruto                     AS importe,
        r.horometro_salida,
        r.horometro_regreso,
        r.descuentos,
        r.total_neto,
        -- Operario principal (primero asignado)
        (SELECT em.full_name
         FROM remision_operarios ro
         JOIN employees em ON em.id = ro.empleado_id
         WHERE ro.remision_id = r.id
         ORDER BY ro.id ASC LIMIT 1)      AS operario_nombre,
        (SELECT em.identification
         FROM remision_operarios ro
         JOIN employees em ON em.id = ro.empleado_id
         WHERE ro.remision_id = r.id
         ORDER BY ro.id ASC LIMIT 1)      AS operario_identificacion,
        e.bonificacion_por_hora
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN equipos e ON e.id = r.equipo_id
      JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.numero_remision DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const dataResult = await query(dataSql, params);

    return {
      data: dataResult.rows,
      kpis: {
        total_servicios:  parseInt(kpis.total_servicios || 0),
        total_facturado:  parseFloat(kpis.total_facturado || 0),
        total_horas:      parseFloat(kpis.total_horas || 0),
        total_descuentos: parseFloat(kpis.total_descuentos || 0),
        total_neto:       parseFloat(kpis.total_neto || 0),
      },
      pagination: {
        total: totalRegistros,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + dataResult.rows.length) < totalRegistros,
      },
    };
  }

  // ============================================================
  // SUBMÓDULO 2: LIQUIDACIÓN GESTIÓN HUMANA
  // ============================================================

  async getLiquidacionGestionHumana({ fecha_desde, fecha_hasta, operario_id, equipo_id, limit = 200, offset = 0 }) {
    const conditions = ['r.deleted_at IS NULL', "r.estado IN ('LIQUIDADA', 'REALIZADA')"];
    const params = [];
    let i = 1;

    if (fecha_desde) { conditions.push(`hl.fecha_trabajo >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta)  { conditions.push(`hl.fecha_trabajo <= $${i++}`); params.push(fecha_hasta); }
    if (operario_id)  { conditions.push(`hl.empleado_id = $${i++}`); params.push(operario_id); }
    if (equipo_id)    { conditions.push(`r.equipo_id = $${i++}`); params.push(equipo_id); }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        em.identification,
        em.full_name                            AS operario,
        em.id                                   AS empleado_id,
        r.numero_remision,
        eq.numero_equipo                        AS maquina,
        eq.marca                                AS equipo_marca,
        hl.fecha_trabajo                        AS fecha_servicio,
        COALESCE(eq.bonificacion_por_hora, 0)   AS bonificacion_por_hora,
        r.cantidad_horas                        AS horas_liquidadas,
        COALESCE(eq.bonificacion_por_hora, 0) * r.cantidad_horas
                                                AS comision_horas_liquidadas,
        hl.total_liquidado                      AS subtotal_operario,
        hl.id                                   AS liquidacion_id,
        r.id                                    AS remision_id
      FROM remision_horas_laborales hl
      JOIN employees em ON em.id = hl.empleado_id
      JOIN remisiones r ON r.id = hl.remision_id
      JOIN equipos eq ON eq.id = r.equipo_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY em.full_name ASC, hl.fecha_trabajo DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const result = await query(sql, params);

    // Total general
    const totalSql = `
      SELECT
        COALESCE(SUM(r.cantidad_horas), 0)                                    AS total_horas,
        COALESCE(SUM(COALESCE(eq.bonificacion_por_hora,0) * r.cantidad_horas), 0) AS total_comision,
        COUNT(DISTINCT hl.empleado_id)                                        AS total_operarios
      FROM remision_horas_laborales hl
      JOIN remisiones r ON r.id = hl.remision_id
      JOIN equipos eq ON eq.id = r.equipo_id
      JOIN employees em ON em.id = hl.empleado_id
      WHERE ${conditions.join(' AND ')}
    `;
    const totalResult = await query(totalSql, params.slice(0, params.length - 2));

    const totales = totalResult.rows[0];

    // Productividad media: (horas_liquidadas / 84) * 100 por operario
    const prodSql = `
      SELECT
        hl.empleado_id,
        em.full_name,
        SUM(r.cantidad_horas) AS total_horas_operario,
        ROUND((SUM(r.cantidad_horas) / 84.0 * 100)::numeric, 2) AS productividad_pct,
        SUM(COALESCE(eq.bonificacion_por_hora, 0) * r.cantidad_horas) AS total_comision_operario
      FROM remision_horas_laborales hl
      JOIN remisiones r ON r.id = hl.remision_id
      JOIN equipos eq ON eq.id = r.equipo_id
      JOIN employees em ON em.id = hl.empleado_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY hl.empleado_id, em.full_name
      ORDER BY em.full_name ASC
    `;
    const prodResult = await query(prodSql, params.slice(0, params.length - 2));

    return {
      data: result.rows,
      subtotalesPorOperario: prodResult.rows,
      totales: {
        total_horas:      parseFloat(totales.total_horas || 0),
        total_comision:   parseFloat(totales.total_comision || 0),
        total_operarios:  parseInt(totales.total_operarios || 0),
        productividad_promedio: prodResult.rows.length > 0
          ? prodResult.rows.reduce((s, r) => s + parseFloat(r.productividad_pct || 0), 0) / prodResult.rows.length
          : 0,
      },
    };
  }

  // ============================================================
  // HISTÓRICO PARA COMPARATIVAS
  // ============================================================

  async saveHistorico(tipo_informe, generado_por, filtros_usados, resumen) {
    const res = await query(
      `INSERT INTO informes_historico (tipo_informe, generado_por, filtros_usados, resumen)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tipo_informe, generado_por, JSON.stringify(filtros_usados), JSON.stringify(resumen)]
    );
    return res.rows[0];
  }

  async getLastHistorico(tipo_informe, excludeId = null) {
    const params = [tipo_informe];
    let cond = '';
    if (excludeId) { params.push(excludeId); cond = `AND id != $2`; }
    const res = await query(
      `SELECT * FROM informes_historico
       WHERE tipo_informe = $1 ${cond}
       ORDER BY fecha_generacion DESC
       LIMIT 1`,
      params
    );
    return res.rows[0] || null;
  }

  async getComparativa(tipo_informe) {
    // Últimos dos registros para comparar actual vs anterior
    const res = await query(
      `SELECT * FROM informes_historico
       WHERE tipo_informe = $1
       ORDER BY fecha_generacion DESC
       LIMIT 2`,
      [tipo_informe]
    );
    if (res.rows.length < 2) return { actual: res.rows[0] || null, anterior: null, delta: null };

    const actual   = res.rows[0];
    const anterior = res.rows[1];
    const a = actual.resumen   || {};
    const b = anterior.resumen || {};

    const calcDelta = (aVal, bVal) => {
      const av = parseFloat(aVal || 0);
      const bv = parseFloat(bVal || 0);
      if (bv === 0) return av > 0 ? 100 : 0;
      return parseFloat(((av - bv) / bv * 100).toFixed(2));
    };

    return {
      actual,
      anterior,
      delta: {
        productividad:  calcDelta(a.productividad_promedio, b.productividad_promedio),
        total_horas:    calcDelta(a.total_horas, b.total_horas),
        total_comision: calcDelta(a.total_comision, b.total_comision),
        total_neto:     calcDelta(a.total_neto, b.total_neto),
      },
    };
  }

  // Catálogos de filtros
  async getFilterOptions() {
    const [operarios, equipos, ciudades, tipos] = await Promise.all([
      query(`SELECT DISTINCT em.id, em.full_name
             FROM employees em
             JOIN remision_operarios ro ON ro.empleado_id = em.id
             WHERE LOWER(em.status) = 'activo'
             ORDER BY em.full_name ASC`),
      query(`SELECT id, numero_equipo, marca, modelo FROM equipos WHERE deleted_at IS NULL ORDER BY numero_equipo ASC`),
      query(`SELECT DISTINCT city FROM companies WHERE city IS NOT NULL AND city != '' ORDER BY city ASC`),
      query(`SELECT DISTINCT tipo FROM catalogo_servicios WHERE tipo IS NOT NULL AND tipo != '' ORDER BY tipo ASC`),
    ]);
    return {
      operarios: operarios.rows,
      equipos:   equipos.rows,
      ciudades:  ciudades.rows.map(r => r.city),
      tipos:     tipos.rows.map(r => r.tipo),
    };
  }
}
