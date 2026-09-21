import { query } from '../../config/database.js';

/**
 * Repository para las pestañas de áreas del Dashboard Gerencial.
 * Mantenimiento, Gestión Humana y Bienestar.
 */
export class DashboardGerenciaAreasRepository {

  // ═══════════════════════════════════════════════════════════
  // MANTENIMIENTO
  // ═══════════════════════════════════════════════════════════

  /**
   * KPIs de Mantenimiento: costo del mes, OTs por estado, preventivos programados.
   */
  async getMantenimiento({ fecha_desde, fecha_hasta } = {}) {
    const [costoMes, otsPorEstado, preventivos] = await Promise.all([
      this.getCostoMantenimiento({ fecha_desde, fecha_hasta }),
      this.getOtsPorEstado({ fecha_desde, fecha_hasta }),
      this.getPreventivosProgramados({ fecha_desde, fecha_hasta }),
    ]);

    return {
      costo_mes: costoMes,
      ots_por_estado: otsPorEstado,
      preventivos_programados: preventivos,
    };
  }

  /**
   * Costo de mantenimiento del período (correctivo vs preventivo).
   * Fuente: ordenes_trabajo + ot_liquidacion
   */
  async getCostoMantenimiento({ fecha_desde, fecha_hasta } = {}) {
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
    const porTipo = {};
    let totalGeneral = 0;
    let cantidadTotal = 0;

    for (const r of result.rows) {
      const tipo = r.tipo_mantenimiento || 'Sin clasificar';
      porTipo[tipo] = {
        cantidad: parseInt(r.cantidad),
        mano_obra: parseFloat(r.total_mano_obra),
        repuestos: parseFloat(r.total_repuestos),
        total: parseFloat(r.total_final),
      };
      totalGeneral += parseFloat(r.total_final);
      cantidadTotal += parseInt(r.cantidad);
    }

    return {
      total_general: totalGeneral,
      cantidad_total: cantidadTotal,
      por_tipo: porTipo,
    };
  }

  /**
   * OTs agrupadas por estado en el período.
   */
  async getOtsPorEstado({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_desde) { conditions.push(`ot.created_at >= $${i++}::date`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`ot.created_at <= $${i++}::date + interval '1 day'`); params.push(fecha_hasta); }

    const sql = `
      SELECT ot.estado, COUNT(*)::int AS cantidad
      FROM ordenes_trabajo ot
      WHERE ${conditions.join(' AND ')}
      GROUP BY ot.estado
      ORDER BY cantidad DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(r => ({
      estado: r.estado,
      cantidad: parseInt(r.cantidad),
    }));
  }

  /**
   * Preventivos programados vs cumplidos en el período.
   * Fuente: mantenimientos_programados + ordenes_trabajo
   */
  async getPreventivosProgramados({ fecha_desde, fecha_hasta } = {}) {
    // Contar OTs de tipo PREVENTIVO creadas en el período
    const conditionsOt = ["ot.tipo_mantenimiento = 'PREVENTIVO'", 'ot.deleted_at IS NULL'];
    const paramsOt = [];
    let iOt = 1;

    if (fecha_desde) { conditionsOt.push(`ot.created_at >= $${iOt++}::date`); paramsOt.push(fecha_desde); }
    if (fecha_hasta) { conditionsOt.push(`ot.created_at <= $${iOt++}::date + interval '1 day'`); paramsOt.push(fecha_hasta); }

    const sqlOt = `
      SELECT
        COUNT(*)::int AS total_creadas,
        COUNT(CASE WHEN ot.estado IN ('CERRADA', 'LIQUIDADA') THEN 1 END)::int AS cerradas
      FROM ordenes_trabajo ot
      WHERE ${conditionsOt.join(' AND ')}
    `;

    // Contar planes de mantenimiento preventivo activos
    const sqlProg = `
      SELECT COUNT(*)::int AS total_programados
      FROM mp_planes_mantenimiento mp
      WHERE mp.activo = TRUE
    `;

    const [otRes, progRes] = await Promise.all([
      query(sqlOt, paramsOt),
      query(sqlProg),
    ]);

    const ot = otRes.rows[0] || {};
    const prog = progRes.rows[0] || {};
    const totalCreadas = parseInt(ot.total_creadas || 0);
    const cerradas = parseInt(ot.cerradas || 0);

    return {
      total_programados: parseInt(prog.total_programados || 0),
      ot_creadas: totalCreadas,
      ot_cerradas: cerradas,
      porcentaje_cumplimiento: totalCreadas > 0
        ? Math.round((cerradas / totalCreadas) * 100 * 10) / 10
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN HUMANA
  // ═══════════════════════════════════════════════════════════

  /**
   * KPIs de Gestión Humana: llamados vs felicitaciones, horas extra.
   */
  async getGestionHumana({ fecha_desde, fecha_hasta } = {}) {
    const [llamadosFelicitaciones, horasExtra, empleadosActivos] = await Promise.all([
      this.getLlamadosFelicitaciones({ fecha_desde, fecha_hasta }),
      this.getHorasExtraPeriodo({ fecha_desde, fecha_hasta }),
      this.getEmpleadosActivos(),
    ]);

    return {
      llamados_felicitaciones: llamadosFelicitaciones,
      horas_extra: horasExtra,
      empleados_activos: empleadosActivos,
    };
  }

  /**
   * Conteo de llamados de atención vs felicitaciones en el período.
   */
  async getLlamadosFelicitaciones({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (fecha_desde) { conditions.push(`el.fecha >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`el.fecha <= $${i++}`); params.push(fecha_hasta); }

    const sql = `
      SELECT
        el.tipo,
        COUNT(*)::int AS cantidad
      FROM empleados_llamados el
      WHERE ${conditions.join(' AND ')}
      GROUP BY el.tipo
    `;

    const result = await query(sql, params);
    const conteo = { LLAMADO_ATENCION: 0, FELICITACION: 0 };
    for (const r of result.rows) {
      conteo[r.tipo] = parseInt(r.cantidad);
    }

    const llamados = conteo.LLAMADO_ATENCION;
    const felicitaciones = conteo.FELICITACION;

    return {
      llamados_atencion: llamados,
      felicitaciones,
      ratio: felicitaciones > 0 ? Math.round((llamados / felicitaciones) * 100) / 100 : (llamados > 0 ? Infinity : 0),
    };
  }

  /**
   * Horas extra liquidadas en el período (desde jornadas_laborales).
   */
  async getHorasExtraPeriodo({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (fecha_desde) { conditions.push(`jl.fecha_trabajo >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`jl.fecha_trabajo <= $${i++}`); params.push(fecha_hasta); }

    const sql = `
      SELECT
        COUNT(DISTINCT jl.empleado_id)::int AS empleados_con_he,
        COALESCE(SUM(jl.total_horas_extras), 0)::numeric(10,2) AS total_horas,
        COALESCE(SUM(jl.total_liquidado), 0)::numeric(14,2) AS total_liquidado
      FROM jornadas_laborales jl
      WHERE ${conditions.join(' AND ')}
        AND jl.total_horas_extras > 0
    `;

    const sqlTop = `
      SELECT
        em.full_name AS nombre,
        SUM(jl.total_horas_extras)::numeric(10,2) AS horas,
        SUM(jl.total_liquidado)::numeric(14,2) AS liquidado
      FROM jornadas_laborales jl
      JOIN employees em ON em.id = jl.empleado_id
      WHERE ${conditions.join(' AND ')}
        AND jl.total_horas_extras > 0
      GROUP BY em.id, em.full_name
      ORDER BY horas DESC
      LIMIT 5
    `;

    const [resumenRes, topRes] = await Promise.all([
      query(sql, params),
      query(sqlTop, params),
    ]);

    const resumen = resumenRes.rows[0] || {};

    return {
      total_liquidado: parseFloat(resumen.total_liquidado || 0),
      total_horas: parseFloat(resumen.total_horas || 0),
      empleados_con_he: parseInt(resumen.empleados_con_he || 0),
      top_operarios: topRes.rows.map(r => ({
        nombre: r.nombre,
        horas: parseFloat(r.horas),
        liquidado: parseFloat(r.liquidado),
      })),
    };
  }

  /**
   * Conteo de empleados activos.
   */
  async getEmpleadosActivos() {
    const result = await query(`SELECT COUNT(*)::int AS total FROM employees WHERE status = 'Activo'`);
    return parseInt(result.rows[0]?.total || 0);
  }

  // ═══════════════════════════════════════════════════════════
  // BIENESTAR
  // ═══════════════════════════════════════════════════════════

  /**
   * KPIs de Bienestar: ausentismo, accidentalidad, días perdidos.
   */
  async getBienestar({ fecha_desde, fecha_hasta } = {}) {
    const [accidentalidad, empleadosActivos] = await Promise.all([
      this.getAccidentalidad({ fecha_desde, fecha_hasta }),
      this.getEmpleadosActivos(),
    ]);

    // Calcular días hábiles del período
    const diasHabiles = await this.getDiasHabiles(fecha_desde, fecha_hasta);

    // Calcular tasa de ausentismo
    const tasaAusentismo = diasHabiles > 0 && empleadosActivos > 0
      ? Math.round((accidentalidad.dias_perdidos_total / (empleadosActivos * diasHabiles)) * 100 * 100) / 100
      : 0;

    return {
      ausentismo: {
        dias_incapacidad: accidentalidad.dias_perdidos_total,
        empleados_activos: empleadosActivos,
        dias_habiles_periodo: diasHabiles,
        tasa_ausentismo_pct: tasaAusentismo,
      },
      accidentalidad: {
        total_accidentes: accidentalidad.total_accidentes,
        con_incapacidad: accidentalidad.con_incapacidad,
        sin_incapacidad: accidentalidad.sin_incapacidad,
        dias_perdidos_total: accidentalidad.dias_perdidos_total,
      },
      empleados_activos: empleadosActivos,
    };
  }

  /**
   * Accidentes laborales en el período con detalle de incapacidad.
   */
  async getAccidentalidad({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (fecha_desde) { conditions.push(`a.fecha >= $${i++}`); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`a.fecha <= $${i++}`); params.push(fecha_hasta); }

    const sql = `
      SELECT
        COUNT(*)::int AS total_accidentes,
        COUNT(CASE WHEN a.genero_incapacidad = TRUE THEN 1 END)::int AS con_incapacidad,
        COUNT(CASE WHEN a.genero_incapacidad = FALSE OR a.genero_incapacidad IS NULL THEN 1 END)::int AS sin_incapacidad,
        COALESCE(SUM(CASE WHEN a.genero_incapacidad = TRUE THEN COALESCE(a.dias_incapacidad, 0) ELSE 0 END), 0)::int AS dias_perdidos_total
      FROM empleados_accidentes a
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await query(sql, params);
    const row = result.rows[0] || {};

    return {
      total_accidentes: parseInt(row.total_accidentes || 0),
      con_incapacidad: parseInt(row.con_incapacidad || 0),
      sin_incapacidad: parseInt(row.sin_incapacidad || 0),
      dias_perdidos_total: parseInt(row.dias_perdidos_total || 0),
    };
  }

  /**
   * Calcula los días hábiles de un período usando festivos_colombia.
   * Si no se especifican fechas, usa el mes actual.
   */
  async getDiasHabiles(fecha_desde, fecha_hasta) {
    const inicio = fecha_desde || (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-01');
    const fin = fecha_hasta || new Date().toISOString().slice(0, 10);

    // First get total days, then count holidays separately to avoid generate_series issues
    const totalSql = `SELECT ($2::date - $1::date + 1)::int AS total_dias`;
    const festivosSql = `
      SELECT COUNT(*)::int AS festivos
      FROM festivos_colombia
      WHERE fecha BETWEEN $1::date AND $2::date
        AND activo = TRUE
    `;

    const [totalRes, festivosRes] = await Promise.all([
      query(totalSql, [inicio, fin]),
      query(festivosSql, [inicio, fin]),
    ]);
    const totalDias = parseInt(totalRes.rows[0]?.total_dias || 0);
    const festivos = parseInt(festivosRes.rows[0]?.festivos || 0);

    return Math.max(totalDias - festivos, 0);
  }

  // ═══════════════════════════════════════════════════════════
  // PRESUPUESTO — SERVICIOS
  // ═══════════════════════════════════════════════════════════

  /**
   * KPI: Ventas vs Presupuesto para el área de Servicios.
   * Real = facturas FACTURADA del área Servicios.
   * Presupuesto = budget_monthly_detail del área Servicios.
   */
  async getPresupuestoServicios({ fecha_desde, fecha_hasta } = {}) {
    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActual = now.getMonth() + 1;

    // Determinar mes del KPI mensual: último mes del rango, o mes actual
    let mesKpi = mesActual;
    let anioKpi = anioActual;
    if (fecha_hasta) {
      const d = new Date(fecha_hasta + 'T00:00:00');
      mesKpi = d.getMonth() + 1;
      anioKpi = d.getFullYear();
    } else if (fecha_desde) {
      const d = new Date(fecha_desde + 'T00:00:00');
      mesKpi = d.getMonth() + 1;
      anioKpi = d.getFullYear();
    }

    // Rango para acumulado: desde inicio del año hasta fin del rango
    const inicioAcum = `${anioKpi}-01-01`;
    const finAcum = fecha_hasta || `${anioKpi}-${String(mesKpi).padStart(2, '0')}-${new Date(anioKpi, mesKpi, 0).getDate()}`;

    // 1. Ventas reales del mes KPI (TODAS las remisiones — consistente con Informes/Servicios)
    const realMesSql = `
      SELECT COALESCE(SUM(r.total_bruto), 0)::numeric(14,2) AS total
      FROM remisiones r
      WHERE r.deleted_at IS NULL
        AND EXTRACT(YEAR FROM r.fecha_servicio) = $1
        AND EXTRACT(MONTH FROM r.fecha_servicio) = $2
    `;

    // 2. Ventas reales acumuladas (enero hasta finAcum) — TODAS las remisiones
    const realAcumSql = `
      SELECT COALESCE(SUM(r.total_bruto), 0)::numeric(14,2) AS total
      FROM remisiones r
      WHERE r.deleted_at IS NULL
        AND r.fecha_servicio >= $1::date
        AND r.fecha_servicio <= $2::date
    `;

    // 3. Presupuesto del mes KPI (área Servicios)
    const presMesSql = `
      SELECT COALESCE(SUM(bmd.amount), 0)::numeric(14,2) AS total
      FROM budget_monthly_detail bmd
      JOIN budget_equipment be ON be.id = bmd.budget_equipment_id
      JOIN budget_annual ba ON ba.id = be.budget_annual_id
      JOIN budget_areas ar ON ar.id = ba.area_id
      WHERE ar.name ILIKE 'Servicios'
        AND ba.year = $1
        AND bmd.month = $2
    `;

    // 4. Presupuesto acumulado (enero hasta mesKpi)
    const presAcumSql = `
      SELECT COALESCE(SUM(bmd.amount), 0)::numeric(14,2) AS total
      FROM budget_monthly_detail bmd
      JOIN budget_equipment be ON be.id = bmd.budget_equipment_id
      JOIN budget_annual ba ON ba.id = be.budget_annual_id
      JOIN budget_areas ar ON ar.id = ba.area_id
      WHERE ar.name ILIKE 'Servicios'
        AND ba.year = $1
        AND bmd.month <= $2
    `;

    const [[realMesRes, realAcumRes, presMesRes, presAcumRes]] = await Promise.all([
      Promise.all([
        query(realMesSql, [anioKpi, mesKpi]),
        query(realAcumSql, [inicioAcum, finAcum]),
        query(presMesSql, [anioKpi, mesKpi]),
        query(presAcumSql, [anioKpi, mesKpi]),
      ]),
    ]);

    const realMes = parseFloat(realMesRes.rows[0]?.total || 0);
    const realAcum = parseFloat(realAcumRes.rows[0]?.total || 0);
    const presMes = parseFloat(presMesRes.rows[0]?.total || 0);
    const presAcum = parseFloat(presAcumRes.rows[0]?.total || 0);

    const mesLabel = new Date(anioKpi, mesKpi - 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });

    return {
      mensual: {
        mes_label: mesLabel,
        real: realMes,
        presupuesto: presMes,
        cumplimiento_pct: presMes > 0 ? parseFloat(((realMes / presMes) * 100).toFixed(1)) : null,
        sin_presupuesto: presMes === 0,
      },
      acumulado: {
        real: realAcum,
        presupuesto: presAcum,
        cumplimiento_pct: presAcum > 0 ? parseFloat(((realAcum / presAcum) * 100).toFixed(1)) : null,
        sin_presupuesto: presAcum === 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PRESUPUESTO — MANTENIMIENTO
  // ═══════════════════════════════════════════════════════════

  /**
   * KPI: Costo vs Presupuesto para el área de Mantenimiento.
   * Real = ot_liquidacion.total_final de OTs LIQUIDADAS.
   * Presupuesto = budget_mantenimiento_mensual (todas las líneas).
   */
  async getPresupuestoMantenimiento({ fecha_desde, fecha_hasta } = {}) {
    const now2 = new Date();
    const anioActual = now2.getFullYear();
    const mesActual = now2.getMonth() + 1;

    let mesKpi = mesActual;
    let anioKpi = anioActual;
    if (fecha_hasta) {
      const d = new Date(fecha_hasta + 'T00:00:00');
      mesKpi = d.getMonth() + 1;
      anioKpi = d.getFullYear();
    } else if (fecha_desde) {
      const d = new Date(fecha_desde + 'T00:00:00');
      mesKpi = d.getMonth() + 1;
      anioKpi = d.getFullYear();
    }

    const inicioAcum = `${anioKpi}-01-01`;
    const finAcum = fecha_hasta || `${anioKpi}-${String(mesKpi).padStart(2, '0')}-${new Date(anioKpi, mesKpi, 0).getDate()}`;

    // 1. Costo real del mes (ot_liquidacion de OTs LIQUIDADAS)
    const realMesSql = `
      SELECT COALESCE(SUM(otl.total_final), 0)::numeric(14,2) AS total
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ot.estado = 'LIQUIDADA'
        AND ot.deleted_at IS NULL
        AND EXTRACT(YEAR FROM otl.fecha_liquidacion) = $1
        AND EXTRACT(MONTH FROM otl.fecha_liquidacion) = $2
    `;

    // 2. Costo real acumulado (enero hasta finAcum)
    const realAcumSql = `
      SELECT COALESCE(SUM(otl.total_final), 0)::numeric(14,2) AS total
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ot.estado = 'LIQUIDADA'
        AND ot.deleted_at IS NULL
        AND otl.fecha_liquidacion >= $1::date
        AND otl.fecha_liquidacion <= $2::date
    `;

    // 3. Presupuesto del mes (budget_mantenimiento_mensual, todas las líneas)
    const presMesSql = `
      SELECT COALESCE(SUM(bmm.amount), 0)::numeric(14,2) AS total
      FROM budget_mantenimiento_mensual bmm
      JOIN budget_business_lines bl ON bl.id = bmm.linea_negocio_id
      WHERE bl.is_active = TRUE
        AND bmm.year = $1
        AND bmm.month = $2
    `;

    // 4. Presupuesto acumulado (enero hasta mesKpi)
    const presAcumSql = `
      SELECT COALESCE(SUM(bmm.amount), 0)::numeric(14,2) AS total
      FROM budget_mantenimiento_mensual bmm
      JOIN budget_business_lines bl ON bl.id = bmm.linea_negocio_id
      WHERE bl.is_active = TRUE
        AND bmm.year = $1
        AND bmm.month <= $2
    `;

    const [realMesRes, realAcumRes, presMesRes, presAcumRes] = await Promise.all([
      query(realMesSql, [anioKpi, mesKpi]),
      query(realAcumSql, [inicioAcum, finAcum]),
      query(presMesSql, [anioKpi, mesKpi]),
      query(presAcumSql, [anioKpi, mesKpi]),
    ]);

    const realMes = parseFloat(realMesRes.rows[0]?.total || 0);
    const realAcum = parseFloat(realAcumRes.rows[0]?.total || 0);
    const presMes = parseFloat(presMesRes.rows[0]?.total || 0);
    const presAcum = parseFloat(presAcumRes.rows[0]?.total || 0);

    const mesLabel = new Date(anioKpi, mesKpi - 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });

    return {
      mensual: {
        mes_label: mesLabel,
        real: realMes,
        presupuesto: presMes,
        cumplimiento_pct: presMes > 0 ? parseFloat(((realMes / presMes) * 100).toFixed(1)) : null,
        sin_presupuesto: presMes === 0,
      },
      acumulado: {
        real: realAcum,
        presupuesto: presAcum,
        cumplimiento_pct: presAcum > 0 ? parseFloat(((realAcum / presAcum) * 100).toFixed(1)) : null,
        sin_presupuesto: presAcum === 0,
      },
    };
  }
}
