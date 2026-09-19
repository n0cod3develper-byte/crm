import { query } from '../../config/database.js';

/**
 * Repository para el Dashboard Gerencial.
 * Agrupa 6 KPIs en un solo endpoint usando Promise.all para paralelizar.
 */
export class DashboardGerenciaRepository {
  /**
   * Retorna todos los KPIs del dashboard gerencial.
   */
  async getKpis({ fecha_desde, fecha_hasta } = {}) {
    const opts = { fecha_desde, fecha_hasta };
    const [
      ingresosMes,
      carteraPorAntiguedad,
      utilizacionFlota,
      remisionesPendientes,
      costoMantenimientoMes,
      topClientes,
      tendenciaIngresos,
    ] = await Promise.all([
      this.getIngresosDelMes(opts),
      this.getCarteraPorAntiguedad(),
      this.getUtilizacionFlota(),
      this.getRemisionesPendientes(opts),
      this.getCostoMantenimientoMes(opts),
      this.getTopClientes(opts),
      this.getTendenciaIngresosMensual(),
    ]);

    return {
      ingresos_mes: ingresosMes,
      cartera_por_antiguedad: carteraPorAntiguedad,
      utilizacion_flota: utilizacionFlota,
      remisiones_pendientes: remisionesPendientes,
      costo_mantenimiento: costoMantenimientoMes,
      top_clientes: topClientes,
      tendencia_ingresos: tendenciaIngresos,
    };
  }

  /**
   * KPI 1: Ingresos del mes vs mes anterior vs mismo mes año anterior.
   * Fuente: tabla facturas (estado = 'FACTURADA').
   */
  async getIngresosDelMes({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ["estado = 'FACTURADA'", 'fecha_factura IS NOT NULL'];
    const params = [];
    let i = 1;
    if (fecha_desde) { conditions.push(`fecha_factura >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`fecha_factura <= $${i++}`); params.push(fecha_hasta); }
    // FIX: Se usan subqueries escalares en lugar de CROSS JOIN para evitar que
    // una CTE vacía (sin datos del mes anterior o año anterior) devuelva 0 filas
    // y silenciara el KPI del mes actual.
    const sql = `
      WITH datos AS (
        SELECT
          DATE_TRUNC('month', fecha_factura)::date AS mes,
          SUM(total) AS total_ingresos,
          COUNT(*) AS cantidad_facturas
        FROM facturas
        WHERE ${conditions.join(' AND ')}
        GROUP BY DATE_TRUNC('month', fecha_factura)
      ),
      ultimo_mes AS (
        SELECT mes FROM datos ORDER BY mes DESC LIMIT 1
      )
      SELECT
        COALESCE(
          (SELECT d.total_ingresos FROM datos d JOIN ultimo_mes um ON d.mes = um.mes),
          0
        ) AS mes_actual,
        COALESCE(
          (SELECT d.cantidad_facturas FROM datos d JOIN ultimo_mes um ON d.mes = um.mes),
          0
        ) AS cantidad_facturas,
        COALESCE(
          (SELECT d.total_ingresos FROM datos d, ultimo_mes um WHERE d.mes = um.mes - INTERVAL '1 month'),
          0
        ) AS mes_anterior,
        COALESCE(
          (SELECT d.total_ingresos FROM datos d, ultimo_mes um
           WHERE EXTRACT(MONTH FROM d.mes) = EXTRACT(MONTH FROM um.mes - INTERVAL '12 months')
             AND EXTRACT(YEAR  FROM d.mes) = EXTRACT(YEAR  FROM um.mes - INTERVAL '12 months')),
          0
        ) AS mismo_mes_anio_anterior,
        CASE
          WHEN COALESCE(
                 (SELECT d.total_ingresos FROM datos d, ultimo_mes um WHERE d.mes = um.mes - INTERVAL '1 month'),
                 0
               ) > 0
          THEN ROUND((
            (COALESCE((SELECT d.total_ingresos FROM datos d JOIN ultimo_mes um ON d.mes = um.mes), 0)
             - (SELECT d.total_ingresos FROM datos d, ultimo_mes um WHERE d.mes = um.mes - INTERVAL '1 month'))
            / (SELECT d.total_ingresos FROM datos d, ultimo_mes um WHERE d.mes = um.mes - INTERVAL '1 month')
            * 100
          )::numeric, 1)
          ELSE NULL
        END AS variacion_vs_anterior_pct,
        CASE
          WHEN COALESCE(
                 (SELECT d.total_ingresos FROM datos d, ultimo_mes um
                  WHERE EXTRACT(MONTH FROM d.mes) = EXTRACT(MONTH FROM um.mes - INTERVAL '12 months')
                    AND EXTRACT(YEAR  FROM d.mes) = EXTRACT(YEAR  FROM um.mes - INTERVAL '12 months')),
                 0
               ) > 0
          THEN ROUND((
            (COALESCE((SELECT d.total_ingresos FROM datos d JOIN ultimo_mes um ON d.mes = um.mes), 0)
             - (SELECT d.total_ingresos FROM datos d, ultimo_mes um
                WHERE EXTRACT(MONTH FROM d.mes) = EXTRACT(MONTH FROM um.mes - INTERVAL '12 months')
                  AND EXTRACT(YEAR  FROM d.mes) = EXTRACT(YEAR  FROM um.mes - INTERVAL '12 months')))
            / (SELECT d.total_ingresos FROM datos d, ultimo_mes um
               WHERE EXTRACT(MONTH FROM d.mes) = EXTRACT(MONTH FROM um.mes - INTERVAL '12 months')
                 AND EXTRACT(YEAR  FROM d.mes) = EXTRACT(YEAR  FROM um.mes - INTERVAL '12 months'))
            * 100
          )::numeric, 1)
          ELSE NULL
        END AS variacion_vs_anio_anterior_pct
      FROM (SELECT 1) dummy
    `;
    const result = await query(sql, params);
    const row = result.rows[0] || {};
    return {
      mes_actual: parseFloat(row.mes_actual || 0),
      cantidad_facturas: parseInt(row.cantidad_facturas || 0),
      mes_anterior: parseFloat(row.mes_anterior || 0),
      mismo_mes_anio_anterior: parseFloat(row.mismo_mes_anio_anterior || 0),
      variacion_vs_anterior_pct: row.variacion_vs_anterior_pct != null ? parseFloat(row.variacion_vs_anterior_pct) : null,
      variacion_vs_anio_anterior_pct: row.variacion_vs_anio_anterior_pct != null ? parseFloat(row.variacion_vs_anio_anterior_pct) : null,
    };
  }

  /**
   * KPI extra: Tendencia de ingresos mensuales (últimos 12 meses).
   * Fuente: tabla facturas (estado = 'FACTURADA').
   */
  async getTendenciaIngresosMensual() {
    const sql = `
      WITH meses AS (
        SELECT
          to_char(date_trunc('month', d), 'YYYY-MM') AS mes,
          to_char(date_trunc('month', d), 'Mon YYYY') AS mes_label,
          EXTRACT(MONTH FROM d)::int AS mes_num
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
          date_trunc('month', CURRENT_DATE),
          '1 month'
        ) d
      ),
      facturado AS (
        SELECT
          to_char(date_trunc('month', fecha_factura), 'YYYY-MM') AS mes,
          SUM(total) AS total_ingresos,
          COUNT(*) AS cantidad_facturas
        FROM facturas
        WHERE estado = 'FACTURADA'
          AND fecha_factura IS NOT NULL
          AND fecha_factura >= (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')
        GROUP BY to_char(date_trunc('month', fecha_factura), 'YYYY-MM')
      )
      SELECT
        m.mes,
        m.mes_label,
        m.mes_num,
        COALESCE(f.total_ingresos, 0) AS total_ingresos,
        COALESCE(f.cantidad_facturas, 0) AS cantidad_facturas
      FROM meses m
      LEFT JOIN facturado f ON f.mes = m.mes
      ORDER BY m.mes ASC
    `;
    const result = await query(sql);
    return result.rows.map(r => ({
      mes: r.mes,
      mes_label: r.mes_label,
      total_ingresos: parseFloat(r.total_ingresos || 0),
      cantidad_facturas: parseInt(r.cantidad_facturas || 0),
    }));
  }

  /**
   * KPI 2: Cartera por antigüedad (0-30 / 31-60 / 61-90 / +90 días).
   */
  async getCarteraPorAntiguedad() {
    const sql = `
      SELECT
        COUNT(CASE WHEN (CURRENT_DATE - fecha_vencimiento) BETWEEN 0 AND 30 THEN 1 END) AS r_0_30_cantidad,
        SUM(CASE WHEN (CURRENT_DATE - fecha_vencimiento) BETWEEN 0 AND 30 THEN total ELSE 0 END) AS r_0_30_valor,
        COUNT(CASE WHEN (CURRENT_DATE - fecha_vencimiento) BETWEEN 31 AND 60 THEN 1 END) AS r_31_60_cantidad,
        SUM(CASE WHEN (CURRENT_DATE - fecha_vencimiento) BETWEEN 31 AND 60 THEN total ELSE 0 END) AS r_31_60_valor,
        COUNT(CASE WHEN (CURRENT_DATE - fecha_vencimiento) BETWEEN 61 AND 90 THEN 1 END) AS r_61_90_cantidad,
        SUM(CASE WHEN (CURRENT_DATE - fecha_vencimiento) BETWEEN 61 AND 90 THEN total ELSE 0 END) AS r_61_90_valor,
        COUNT(CASE WHEN (CURRENT_DATE - fecha_vencimiento) > 90 THEN 1 END) AS r_mas_90_cantidad,
        SUM(CASE WHEN (CURRENT_DATE - fecha_vencimiento) > 90 THEN total ELSE 0 END) AS r_mas_90_valor,
        COUNT(*) AS total_cantidad,
        SUM(total) AS total_valor
      FROM facturas
      WHERE estado = 'FACTURADA'
        AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento <= CURRENT_DATE
    `;
    const result = await query(sql);
    const row = result.rows[0] || {};
    return {
      rangos: [
        { rango: '0-30 días',   cantidad: parseInt(row.r_0_30_cantidad || 0),  valor: parseFloat(row.r_0_30_valor || 0) },
        { rango: '31-60 días',  cantidad: parseInt(row.r_31_60_cantidad || 0), valor: parseFloat(row.r_31_60_valor || 0) },
        { rango: '61-90 días',  cantidad: parseInt(row.r_61_90_cantidad || 0), valor: parseFloat(row.r_61_90_valor || 0) },
        { rango: '+90 días',    cantidad: parseInt(row.r_mas_90_cantidad || 0), valor: parseFloat(row.r_mas_90_valor || 0) },
      ],
      total_cantidad: parseInt(row.total_cantidad || 0),
      total_valor: parseFloat(row.total_valor || 0),
    };
  }

  /**
   * KPI 3: Utilización de flota — equipos con remisión activa (LIQUIDADA/FACTURADA en curso) vs total por tipo.
   * Fuente: equipos + remisiones (fecha_servicio = hoy, estado != ANULADO).
   */
  async getUtilizacionFlota() {
    const sql = `
      WITH flota_total AS (
        SELECT
          CASE COALESCE(tipo_equipo, 'OTRO')
            WHEN 'MONTACARGAS' THEN 'Montacargas'
            WHEN 'ELEVADOR'    THEN 'Elevador'
            WHEN 'ESTIBADOR'   THEN 'Estibador'
            WHEN 'CAMIONETA'   THEN 'Camioneta'
            WHEN 'AMBULANCIA'  THEN 'Ambulancia'
            WHEN 'CARGADOR'    THEN 'Cargador'
            WHEN 'BATERIA'     THEN 'Batería'
            ELSE COALESCE(tipo_equipo, motor, 'Otro')
          END AS tipo,
          COUNT(*) AS total
        FROM equipos
        WHERE deleted_at IS NULL
          AND COALESCE(estado, 'OPERATIVO') != 'RETIRADO'
        GROUP BY 1
      ),
      en_servicio AS (
        SELECT
          CASE COALESCE(e.tipo_equipo, 'OTRO')
            WHEN 'MONTACARGAS' THEN 'Montacargas'
            WHEN 'ELEVADOR'    THEN 'Elevador'
            WHEN 'ESTIBADOR'   THEN 'Estibador'
            WHEN 'CAMIONETA'   THEN 'Camioneta'
            WHEN 'AMBULANCIA'  THEN 'Ambulancia'
            WHEN 'CARGADOR'    THEN 'Cargador'
            WHEN 'BATERIA'     THEN 'Batería'
            ELSE COALESCE(e.tipo_equipo, e.motor, 'Otro')
          END AS tipo,
          COUNT(DISTINCT r.equipo_id) AS activos
        FROM remisiones r
        JOIN equipos e ON e.id = r.equipo_id
        WHERE r.deleted_at IS NULL
          AND r.fecha_servicio = CURRENT_DATE
          AND r.estado NOT IN ('ANULADO', 'ANULADA')
        GROUP BY 1
      )
      SELECT
        ft.tipo,
        ft.total AS total_equipos,
        COALESCE(es.activos, 0) AS en_servicio
      FROM flota_total ft
      LEFT JOIN en_servicio es ON es.tipo = ft.tipo
      ORDER BY ft.total DESC
    `;
    const result = await query(sql);
    const tipos = result.rows.map(r => ({
      tipo: r.tipo,
      total_equipos: parseInt(r.total_equipos),
      en_servicio: parseInt(r.en_servicio),
      porcentaje: parseInt(r.total_equipos) > 0
        ? Math.round((parseInt(r.en_servicio) / parseInt(r.total_equipos)) * 100)
        : 0,
    }));
    const totalEquipos = tipos.reduce((s, t) => s + t.total_equipos, 0);
    const totalEnServicio = tipos.reduce((s, t) => s + t.en_servicio, 0);
    return {
      tipos,
      total_equipos: totalEquipos,
      total_en_servicio: totalEnServicio,
      porcentaje_global: totalEquipos > 0 ? Math.round((totalEnServicio / totalEquipos) * 100) : 0,
    };
  }

  /**
   * KPI 4: Remisiones/OTs liquidadas pendientes de facturar.
   * Fuente: vista ots_pendientes_facturar + remisiones LIQUIDADA sin factura.
   */
  async getRemisionesPendientes({ fecha_desde, fecha_hasta } = {}) {
    const conditionsRem = ["r.estado = 'LIQUIDADA'", 'r.factura_id IS NULL', 'r.deleted_at IS NULL'];
    const paramsRem = [];
    let iRem = 1;
    if (fecha_desde) { conditionsRem.push(`r.fecha_servicio >= $${iRem++}`); paramsRem.push(fecha_desde); }
    if (fecha_hasta) { conditionsRem.push(`r.fecha_servicio <= $${iRem++}`); paramsRem.push(fecha_hasta); }
    const whereClauseRem = `WHERE ${conditionsRem.join(' AND ')}`;

    const conditionsOt = [];
    const paramsOt = [];
    let iOt = 1;
    if (fecha_desde) { conditionsOt.push(`fecha_liquidacion >= $${iOt++}::date`); paramsOt.push(fecha_desde); }
    if (fecha_hasta) { conditionsOt.push(`fecha_liquidacion <= ($${iOt++}::date + interval '1 day')`); paramsOt.push(fecha_hasta); }
    const whereClauseOt = conditionsOt.length ? `WHERE ${conditionsOt.join(' AND ')}` : '';

    const sql = `
      SELECT
        COUNT(*)::int AS cantidad_total,
        COALESCE(SUM(total), 0)::numeric(14,2) AS valor_total
      FROM ots_pendientes_facturar
      ${whereClauseOt}
    `;
    const sqlRem = `
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(r.total_neto), 0)::numeric(14,2) AS valor
      FROM remisiones r
      ${whereClauseRem}
    `;
    const [otsRes, remRes] = await Promise.all([query(sql, paramsOt), query(sqlRem, paramsRem)]);
    const ots = otsRes.rows[0] || {};
    const rem = remRes.rows[0] || {};
    return {
      ots: { cantidad: parseInt(ots.cantidad_total || 0), valor: parseFloat(ots.valor_total || 0) },
      remisiones: { cantidad: parseInt(rem.cantidad || 0), valor: parseFloat(rem.valor || 0) },
      total_cantidad: parseInt(ots.cantidad_total || 0) + parseInt(rem.cantidad || 0),
      total_valor: parseFloat(ots.valor_total || 0) + parseFloat(rem.valor || 0),
    };
  }

  /**
   * KPI 5: Costo de mantenimiento del mes — correctivo vs preventivo.
   * Fuente: ordenes_trabajo + ot_liquidacion (fecha_liquidacion este mes).
   */
  async getCostoMantenimientoMes({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ['ot.deleted_at IS NULL', "ot.estado != 'ANULADA'"];
    const params = [];
    let i = 1;
    if (fecha_desde) { conditions.push(`otl.fecha_liquidacion >= $${i++}::date`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`); params.push(fecha_hasta); }
    if (!fecha_desde && !fecha_hasta) {
      conditions.push("DATE_TRUNC('month', otl.fecha_liquidacion) = DATE_TRUNC('month', CURRENT_DATE)");
    }
    const sql = `
      SELECT
        ot.tipo_mantenimiento,
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(otl.total_mano_obra), 0)::numeric(14,2) AS total_mano_obra,
        COALESCE(SUM(otl.total_repuestos), 0)::numeric(14,2) AS total_repuestos,
        COALESCE(SUM(otl.total_final), 0)::numeric(14,2) AS total_final
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ot.tipo_mantenimiento
    `;
    const result = await query(sql, params);
    const tipos = {};
    let totalGeneral = 0;
    let cantidadTotal = 0;

    for (const r of result.rows) {
      const tipo = r.tipo_mantenimiento || 'Sin clasificar';
      tipos[tipo] = {
        cantidad: parseInt(r.cantidad),
        mano_obra: parseFloat(r.total_mano_obra),
        repuestos: parseFloat(r.total_repuestos),
        total: parseFloat(r.total_final),
      };
      totalGeneral += parseFloat(r.total_final);
      cantidadTotal += parseInt(r.cantidad);
    }

    return {
      tipos,
      total_general: totalGeneral,
      cantidad_total: cantidadTotal,
    };
  }

  /**
   * KPI 6: Top 10 clientes por facturación.
   * Fuente: facturas FACTURADA agrupadas por empresa.
   */
  async getTopClientes({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ["f.estado = 'FACTURADA'", 'f.fecha_factura IS NOT NULL'];
    const params = [];
    let i = 1;
    if (fecha_desde) { conditions.push(`f.fecha_factura >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`f.fecha_factura <= $${i++}`); params.push(fecha_hasta); }
    const sql = `
      SELECT
        c.name AS nombre,
        COUNT(f.id)::int AS cantidad_facturas,
        COALESCE(SUM(f.total), 0)::numeric(14,2) AS total_facturado
      FROM facturas f
      JOIN companies c ON c.id = f.empresa_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, c.name
      ORDER BY total_facturado DESC
      LIMIT 10
    `;
    const result = await query(sql, params);
    return result.rows.map(r => ({
      nombre: r.nombre,
      cantidad_facturas: parseInt(r.cantidad_facturas),
      total_facturado: parseFloat(r.total_facturado),
    }));
  }

  /**
   * Detalle de cartera por rango de antigüedad.
   * rango_min / rango_max = días de antigüedad.
   */
  async getCarteraDetalle({ rango_min, rango_max }) {
    const params = [];
    let i = 1;
    let rangoCondition;
    if (rango_max != null) {
      rangoCondition = `(CURRENT_DATE - f.fecha_vencimiento) BETWEEN $${i++} AND $${i++}`;
      params.push(rango_min, rango_max);
    } else {
      // FIX: >= para incluir exactamente el día del rango_min (ej. 91 días → +90)
      rangoCondition = `(CURRENT_DATE - f.fecha_vencimiento) >= $${i++}`;
      params.push(rango_min);
    }
    const sql = `
      SELECT
        f.consecutivo_interno,
        f.numero_factura,
        c.name AS empresa_nombre,
        c.nit AS empresa_nit,
        f.fecha_factura,
        f.fecha_vencimiento,
        (CURRENT_DATE - f.fecha_vencimiento) AS dias_vencido,
        f.subtotal,
        f.iva_valor,
        f.total
      FROM facturas f
      JOIN companies c ON c.id = f.empresa_id
      WHERE f.estado = 'FACTURADA'
        AND f.fecha_vencimiento IS NOT NULL
        AND f.fecha_vencimiento <= CURRENT_DATE
        AND ${rangoCondition}
      ORDER BY f.fecha_vencimiento ASC
    `;
    const result = await query(sql, params);
    return result.rows.map(r => ({
      consecutivo: r.consecutivo_interno,
      numero_factura: r.numero_factura,
      empresa: r.empresa_nombre,
      nit: r.empresa_nit,
      fecha_factura: r.fecha_factura,
      fecha_vencimiento: r.fecha_vencimiento,
      dias_vencido: parseInt(r.dias_vencido),
      subtotal: parseFloat(r.subtotal),
      iva: parseFloat(r.iva_valor),
      total: parseFloat(r.total),
    }));
  }

  /**
   * Detalle de remisiones/OTs pendientes de facturar.
   */
  async getPendientesDetalle({ fecha_desde, fecha_hasta } = {}) {
    // OTs liquidadas/parciales pendientes (desde la vista para consistencia total)
    const conditionsOt = [];
    const paramsOt = [];
    let iOt = 1;
    if (fecha_desde) { conditionsOt.push(`fecha_liquidacion >= $${iOt++}::date`); paramsOt.push(fecha_desde); }
    if (fecha_hasta) { conditionsOt.push(`fecha_liquidacion <= ($${iOt++}::date + interval '1 day')`); paramsOt.push(fecha_hasta); }
    const whereClauseOt = conditionsOt.length ? `WHERE ${conditionsOt.join(' AND ')}` : '';

    const sqlOt = `
      SELECT
        'OT' AS tipo,
        consecutivo AS numero,
        empresa_nombre,
        tipo_mantenimiento,
        fecha_liquidacion AS fecha,
        total
      FROM ots_pendientes_facturar
      ${whereClauseOt}
      ORDER BY fecha_liquidacion ASC
    `;

    // Remisiones liquidadas pendientes
    const conditionsRem = ["r.estado = 'LIQUIDADA'", 'r.factura_id IS NULL', 'r.deleted_at IS NULL'];
    const paramsRem = [];
    let iRem = 1;
    if (fecha_desde) { conditionsRem.push(`r.fecha_servicio >= $${iRem++}`); paramsRem.push(fecha_desde); }
    if (fecha_hasta) { conditionsRem.push(`r.fecha_servicio <= $${iRem++}`); paramsRem.push(fecha_hasta); }
    const sqlRem = `
      SELECT
        'Remisión' AS tipo,
        r.numero_remision AS numero,
        c.name AS empresa_nombre,
        NULL AS tipo_mantenimiento,
        r.fecha_servicio AS fecha,
        COALESCE(r.total_neto, 0) AS total
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      WHERE ${conditionsRem.join(' AND ')}
      ORDER BY r.fecha_servicio ASC
    `;
    const [otRes, remRes] = await Promise.all([
      query(sqlOt, paramsOt),
      query(sqlRem, paramsRem),
    ]);
    const items = [
      ...otRes.rows.map(r => ({
        tipo: r.tipo,
        numero: r.numero,
        empresa: r.empresa_nombre,
        detalle: r.tipo_mantenimiento,
        fecha: r.fecha,
        total: parseFloat(r.total),
      })),
      ...remRes.rows.map(r => ({
        tipo: r.tipo,
        numero: r.numero,
        empresa: r.empresa_nombre,
        detalle: null,
        fecha: r.fecha,
        total: parseFloat(r.total),
      })),
    ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return items;
  }
}
