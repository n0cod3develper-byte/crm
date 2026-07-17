import { query } from '../../config/database.js';

export class InformesRepository {
  async getVentasPorLineaNegocio(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`r.fecha_servicio >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`r.fecha_servicio <= $${i++}`);
      params.push(fecha_fin);
    }

    // Usamos el total_bruto o el subtotal. Seguiremos con total_bruto de remisiones
    const sql = `
      SELECT COALESCE(cs.tipo_servicio, 'Otras Ventas') AS linea_negocio,
             SUM(r.total_bruto) AS total_ventas
      FROM remisiones r
      LEFT JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY COALESCE(cs.tipo_servicio, 'Otras Ventas')
      ORDER BY total_ventas DESC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async getVentasMensuales(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`r.fecha_servicio >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`r.fecha_servicio <= $${i++}`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT 
        to_char(date_trunc('month', r.fecha_servicio), 'YYYY-MM') AS mes,
        SUM(r.total_bruto) AS total_ventas
      FROM remisiones r
      WHERE ${conditions.join(' AND ')}
      GROUP BY date_trunc('month', r.fecha_servicio)
      ORDER BY mes ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }
  async getVentasPorEquipo(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`r.fecha_servicio >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`r.fecha_servicio <= $${i++}`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT 
        COALESCE(e.marca || ' - ' || e.serie, 'Sin Equipo / Otros') AS equipo_nombre,
        e.serie,
        SUM(r.total_bruto) AS total_ventas
      FROM remisiones r
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.marca, e.serie
      ORDER BY total_ventas DESC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async getSalesVsBudget(equipment_id, date_from, date_to) {
    const isAll = equipment_id === 'all';
    let targetEmpresaId = null;

    if (isAll) {
      const resEmp = await query(`SELECT id FROM companies WHERE name ILIKE 'CARGAR%' LIMIT 1`);
      targetEmpresaId = resEmp.rows[0]?.id;
    }

    // 1. Obtener las ventas agrupadas por mes para el equipo (Real)
    const salesConditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
    const salesParams = [];
    let i = 1;

    if (isAll) {
      salesConditions.push('e.empresa_id = $1');
      salesParams.push(targetEmpresaId);
      i = 2;
    } else {
      salesConditions.push('r.equipo_id = $1');
      salesParams.push(equipment_id);
      i = 2;
    }

    if (date_from) {
      salesConditions.push(`r.fecha_servicio >= $${i++}`);
      salesParams.push(date_from);
    }
    if (date_to) {
      salesConditions.push(`r.fecha_servicio <= $${i++}`);
      salesParams.push(date_to);
    }

    const salesSql = `
      SELECT 
        to_char(date_trunc('month', r.fecha_servicio), 'YYYY-MM') AS month,
        SUM(r.total_bruto) AS sales
      FROM remisiones r
      ${isAll ? 'JOIN equipos e ON e.id = r.equipo_id' : ''}
      WHERE ${salesConditions.join(' AND ')}
      GROUP BY date_trunc('month', r.fecha_servicio)
      ORDER BY month ASC
    `;
    const salesRes = await query(salesSql, salesParams);
    const salesMap = new Map();
    salesRes.rows.forEach(r => salesMap.set(r.month, parseFloat(r.sales || 0)));

    // 2. Obtener el presupuesto del equipo
    const yearFrom = date_from ? parseInt(date_from.substring(0,4)) : new Date().getFullYear();
    const yearTo = date_to ? parseInt(date_to.substring(0,4)) : new Date().getFullYear();

    let budgetSql;
    let budgetParams;

    if (isAll) {
      budgetSql = `
        SELECT ba.year, bmd.month as month_num, SUM(bmd.amount) as amount
        FROM budget_equipment be
        JOIN equipos e ON e.id = be.equipment_id
        JOIN budget_annual ba ON ba.id = be.budget_annual_id
        JOIN budget_monthly_detail bmd ON bmd.budget_equipment_id = be.id
        WHERE e.empresa_id = $1 AND ba.year >= $2 AND ba.year <= $3
        GROUP BY ba.year, bmd.month
      `;
      budgetParams = [targetEmpresaId, yearFrom, yearTo];
    } else {
      budgetSql = `
        SELECT ba.year, bmd.month as month_num, bmd.amount
        FROM budget_equipment be
        JOIN budget_annual ba ON ba.id = be.budget_annual_id
        JOIN budget_monthly_detail bmd ON bmd.budget_equipment_id = be.id
        WHERE be.equipment_id = $1 AND ba.year >= $2 AND ba.year <= $3
      `;
      budgetParams = [equipment_id, yearFrom, yearTo];
    }

    const budgetRes = await query(budgetSql, budgetParams);
    const budgetMap = new Map();
    budgetRes.rows.forEach(r => {
      const mStr = String(r.month_num).padStart(2, '0');
      budgetMap.set(`${r.year}-${mStr}`, parseFloat(r.amount || 0));
    });

    // 3. Obtener info del equipo
    let eqName = 'Todos los Equipos';
    if (!isAll) {
      const eqRes = await query(`SELECT marca, serie FROM equipos WHERE id = $1`, [equipment_id]);
      eqName = eqRes.rows[0] ? `${eqRes.rows[0].marca} - ${eqRes.rows[0].serie}` : 'Desconocido';
    }

    // 4. Combinar los datos
    const allMonths = Array.from(new Set([...salesMap.keys(), ...budgetMap.keys()])).sort();
    const data = allMonths.map(m => ({
      month: m,
      sales: salesMap.get(m) || 0,
      budget: budgetMap.get(m) || 0
    }));

    const filteredData = data.filter(d => {
      let keep = true;
      if (date_from) {
        keep = keep && d.month >= date_from.substring(0,7);
      }
      if (date_to) {
        keep = keep && d.month <= date_to.substring(0,7);
      }
      return keep;
    });

    return {
      equipment: eqName,
      data: filteredData
    };
  }

  // =============================================
  // KPI: HORAS TRABAJADAS POR EQUIPO
  // =============================================
  async getHoursByEquipment(date_from, date_to) {
    const conditions = [
      "r.deleted_at IS NULL",
      "r.estado = 'LIQUIDADA'",
      "r.hora_salida_cargar IS NOT NULL",
      "r.hora_llegada_cargar IS NOT NULL"
    ];
    const params = [];
    let i = 1;

    if (date_from) { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(date_from); }
    if (date_to)   { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(date_to); }

    const sql = `
      SELECT
        e.id AS equipment_id,
        COALESCE(e.marca || ' - Serie: ' || e.serie, 'Sin Equipo') AS equipment_name,
        COUNT(r.id) AS total_orders,
        SUM(
          CASE
            WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
            THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
            ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
          END
        ) AS total_hours
      FROM remisiones r
      JOIN equipos e ON e.id = r.equipo_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.id, e.marca, e.serie
      HAVING SUM(
        CASE
          WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
          THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
          ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
        END
      ) > 0
      ORDER BY total_hours DESC
    `;

    const result = await query(sql, params);

    // Count excluded orders (LIQUIDADA but missing time fields)
    const excludedSql = `
      SELECT COUNT(*) AS excluded
      FROM remisiones r
      WHERE r.deleted_at IS NULL
        AND r.estado = 'LIQUIDADA'
        AND (r.hora_salida_cargar IS NULL OR r.hora_llegada_cargar IS NULL)
        ${date_from ? `AND r.fecha_servicio >= $${1}` : ''}
        ${date_to ? `AND r.fecha_servicio <= $${date_from ? 2 : 1}` : ''}
    `;
    const excludedParams = [];
    if (date_from) excludedParams.push(date_from);
    if (date_to) excludedParams.push(date_to);
    const excludedRes = await query(excludedSql, excludedParams);

    const data = result.rows.map(r => ({
      equipment_id: r.equipment_id,
      equipment_name: r.equipment_name,
      total_orders: parseInt(r.total_orders),
      total_hours: parseFloat(parseFloat(r.total_hours).toFixed(2)),
      total_hours_formatted: formatHours(parseFloat(r.total_hours))
    }));

    const grand_total_hours = data.reduce((sum, d) => sum + d.total_hours, 0);

    return {
      date_from,
      date_to,
      area: 'Servicios',
      data,
      grand_total_hours: parseFloat(grand_total_hours.toFixed(2)),
      excluded_orders: parseInt(excludedRes.rows[0]?.excluded || 0)
    };
  }

  // Detail: orders for a specific equipment
  async getHoursByEquipmentDetail(equipment_id, date_from, date_to) {
    const conditions = [
      "r.deleted_at IS NULL",
      "r.estado = 'LIQUIDADA'",
      "r.hora_salida_cargar IS NOT NULL",
      "r.hora_llegada_cargar IS NOT NULL",
      "r.equipo_id = $1"
    ];
    const params = [equipment_id];
    let i = 2;

    if (date_from) { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(date_from); }
    if (date_to)   { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(date_to); }

    const sql = `
      SELECT
        r.id,
        r.numero_remision,
        r.fecha_servicio,
        r.hora_salida_cargar,
        r.hora_llegada_cargar,
        CASE
          WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
          THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
          ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
        END AS hours
      FROM remisiones r
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(r => ({
      id: r.id,
      numero_remision: r.numero_remision,
      fecha_servicio: r.fecha_servicio,
      hora_salida: r.hora_salida_cargar,
      hora_llegada: r.hora_llegada_cargar,
      hours: parseFloat(parseFloat(r.hours).toFixed(2)),
      hours_formatted: formatHours(parseFloat(r.hours))
    }));
  }

  // =============================================
  // KPI: HORAS LABORADAS POR OPERARIO
  // =============================================
  async getHoursByOperator(date_from, date_to) {
    const conditions = [
      "r.deleted_at IS NULL",
      "r.estado = 'LIQUIDADA'",
      "r.hora_salida_cargar IS NOT NULL",
      "r.hora_llegada_cargar IS NOT NULL"
    ];
    const params = [];
    let i = 1;

    if (date_from) { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(date_from); }
    if (date_to)   { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(date_to); }

    // Each operator assigned to an order gets the full hours of that order
    const sql = `
      SELECT
        em.id AS operator_id,
        em.full_name AS operator_name,
        COUNT(r.id) AS total_orders,
        SUM(
          CASE
            WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
            THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
            ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
          END
        ) AS total_hours,
        AVG(
          CASE
            WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
            THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
            ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
          END
        ) AS avg_hours_per_order
      FROM remisiones r
      JOIN remision_operarios ro ON ro.remision_id = r.id
      JOIN employees em ON em.id = ro.empleado_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY em.id, em.full_name
      HAVING SUM(
        CASE
          WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
          THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
          ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
        END
      ) > 0
      ORDER BY total_hours DESC
    `;

    const result = await query(sql, params);

    const data = result.rows.map(r => ({
      operator_id: r.operator_id,
      operator_name: r.operator_name,
      total_orders: parseInt(r.total_orders),
      total_hours: parseFloat(parseFloat(r.total_hours).toFixed(2)),
      total_hours_formatted: formatHours(parseFloat(r.total_hours)),
      average_hours_per_order: parseFloat(parseFloat(r.avg_hours_per_order).toFixed(2))
    }));

    const grand_total_hours = data.reduce((sum, d) => sum + d.total_hours, 0);

    return {
      date_from,
      date_to,
      area: 'Servicios',
      data,
      grand_total_hours: parseFloat(grand_total_hours.toFixed(2))
    };
  }

  // Detail: orders for a specific operator
  async getHoursByOperatorDetail(operator_id, date_from, date_to) {
    const conditions = [
      "r.deleted_at IS NULL",
      "r.estado = 'LIQUIDADA'",
      "r.hora_salida_cargar IS NOT NULL",
      "r.hora_llegada_cargar IS NOT NULL",
      "ro.empleado_id = $1"
    ];
    const params = [operator_id];
    let i = 2;

    if (date_from) { conditions.push(`r.fecha_servicio >= $${i++}`); params.push(date_from); }
    if (date_to)   { conditions.push(`r.fecha_servicio <= $${i++}`); params.push(date_to); }

    const sql = `
      SELECT
        r.id,
        r.numero_remision,
        r.fecha_servicio,
        r.hora_salida_cargar,
        r.hora_llegada_cargar,
        COALESCE(e.marca || ' - ' || e.serie, 'Sin Equipo') AS equipo_nombre,
        CASE
          WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
          THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
          ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
        END AS hours
      FROM remisiones r
      JOIN remision_operarios ro ON ro.remision_id = r.id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(r => ({
      id: r.id,
      numero_remision: r.numero_remision,
      fecha_servicio: r.fecha_servicio,
      equipo_nombre: r.equipo_nombre,
      hora_salida: r.hora_salida_cargar,
      hora_llegada: r.hora_llegada_cargar,
      hours: parseFloat(parseFloat(r.hours).toFixed(2)),
      hours_formatted: formatHours(parseFloat(r.hours))
    }));
  }
  // =============================================
  // INFORME: LIQUIDACIÓN BONIFICACIÓN POR HORAS
  // =============================================

  /**
   * Detalle de servicios LIQUIDADOS/REALIZADOS en el período, con operarios asignados.
   * Bonificación: usa la de la remisión; si es 0, toma la del equipo.
   * Alerta si ambas son 0.
   */
  async getLiquidacionBonificacion(fecha_inicio, fecha_fin) {
    const params = [fecha_inicio, fecha_fin];

    const detalleSql = `
      SELECT
        r.id,
        r.numero_remision,
        r.fecha_servicio,
        r.hora_salida_cargar,
        r.hora_llegada_cargar,
        r.estado,
        -- Bonificación: toma la de la remisión; fallback al equipo si es 0 o NULL
        COALESCE(
          NULLIF(r.bonificacion_hora, 0),
          e.bonificacion_hora,
          0
        ) AS bonificacion_hora,
        -- Flag para alerta: ambas fuentes en 0
        CASE
          WHEN (r.bonificacion_hora IS NULL OR r.bonificacion_hora = 0)
            AND (e.bonificacion_hora IS NULL OR e.bonificacion_hora = 0)
          THEN true ELSE false
        END AS bonificacion_es_cero,
        r.numero_maquina,
        em.id        AS operario_id,
        em.full_name AS operario_nombre,
        em.numero_documento AS cedula,
        em.tipo_documento   AS tipo_doc,
        COALESCE(e.marca || ' ' || e.modelo, r.numero_maquina, 'Sin equipo') AS maquina_nombre,
        e.serial      AS equipo_serial,
        e.capacidad_carga,
        false         AS is_servicio_fijo,
        CASE
          WHEN r.hora_salida_cargar IS NOT NULL AND r.hora_llegada_cargar IS NOT NULL THEN
            CASE
              WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
              THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
              ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
            END
          ELSE 0
        END AS horas_efectivas
      FROM remisiones r
      JOIN  remision_operarios ro ON ro.remision_id = r.id
      JOIN  employees em ON em.id = ro.empleado_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE r.deleted_at IS NULL
        AND r.estado IN ('LIQUIDADA', 'REALIZADA')
        AND r.is_servicio_fijo = false
        AND r.fecha_servicio >= $1
        AND r.fecha_servicio <= $2

      UNION ALL

      SELECT
        r.id,
        r.numero_remision,
        rdf.fecha AS fecha_servicio,
        rdf.hora_entrada AS hora_salida_cargar,
        rdf.hora_salida  AS hora_llegada_cargar,
        r.estado,
        COALESCE(
          NULLIF(rdf.bonificacion_hora, 0),
          e.bonificacion_hora,
          0
        ) AS bonificacion_hora,
        false AS bonificacion_es_cero,
        r.numero_maquina,
        em.id        AS operario_id,
        em.full_name AS operario_nombre,
        em.numero_documento AS cedula,
        em.tipo_documento   AS tipo_doc,
        COALESCE(e.marca || ' ' || e.modelo, r.numero_maquina, 'Sin equipo') AS maquina_nombre,
        e.serial      AS equipo_serial,
        e.capacidad_carga,
        true          AS is_servicio_fijo,
        rdf.horas_netas AS horas_efectivas
      FROM remision_dias_fijo rdf
      JOIN remisiones r ON r.id = rdf.remision_id
      JOIN employees em ON em.id = rdf.empleado_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE r.deleted_at IS NULL
        AND r.estado IN ('LIQUIDADA', 'REALIZADA')
        AND rdf.fecha >= $1
        AND rdf.fecha <= $2
      ORDER BY operario_nombre ASC, fecha_servicio ASC, numero_remision ASC
    `;

    // Alerta 1: sin operario asignado
    const sinOperarioSql = `
      SELECT r.numero_remision, r.fecha_servicio, r.estado,
             COALESCE(r.numero_maquina, 'S/N') AS numero_maquina
      FROM remisiones r
      WHERE r.deleted_at IS NULL
        AND r.estado IN ('LIQUIDADA', 'REALIZADA')
        AND r.fecha_servicio >= $1
        AND r.fecha_servicio <= $2
        AND NOT EXISTS (SELECT 1 FROM remision_operarios ro WHERE ro.remision_id = r.id)
      ORDER BY r.fecha_servicio ASC
    `;

    // Alerta 2: con operario pero sin horas registradas
    const sinHorasSql = `
      SELECT DISTINCT r.numero_remision, r.fecha_servicio, r.estado
      FROM remisiones r
      JOIN remision_operarios ro ON ro.remision_id = r.id
      WHERE r.deleted_at IS NULL
        AND r.estado IN ('LIQUIDADA', 'REALIZADA')
        AND r.fecha_servicio >= $1
        AND r.fecha_servicio <= $2
        AND (r.hora_salida_cargar IS NULL OR r.hora_llegada_cargar IS NULL)
      ORDER BY r.fecha_servicio ASC
    `;

    // Alerta 3: bonificación = 0 en AMBAS fuentes (remisión Y equipo)
    const bonificacionCeroSql = `
      SELECT DISTINCT r.numero_remision, r.fecha_servicio, r.estado,
             COALESCE(r.numero_maquina, 'S/N') AS numero_maquina
      FROM remisiones r
      JOIN remision_operarios ro ON ro.remision_id = r.id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE r.deleted_at IS NULL
        AND r.estado IN ('LIQUIDADA', 'REALIZADA')
        AND r.fecha_servicio >= $1
        AND r.fecha_servicio <= $2
        AND (r.bonificacion_hora IS NULL OR r.bonificacion_hora = 0)
        AND (e.bonificacion_hora IS NULL OR e.bonificacion_hora = 0)
      ORDER BY r.fecha_servicio ASC
    `;

    const [detalleRes, sinOperarioRes, sinHorasRes, bonCeroRes] = await Promise.all([
      query(detalleSql, params),
      query(sinOperarioSql, params),
      query(sinHorasSql, params),
      query(bonificacionCeroSql, params),
    ]);

    const detalleRows = detalleRes.rows.map(r => {
      const horas = parseFloat(parseFloat(r.horas_efectivas || 0).toFixed(2));
      const bonif = parseFloat(r.bonificacion_hora || 0);
      return {
        ...r,
        horas_efectivas: horas,
        bonificacion_hora: bonif,
        comision: parseFloat((horas * bonif).toFixed(0)),
      };
    });

    // Alerta 4: horas = 0 aunque tienen timestamps (posible error)
    const horasInvalidas = detalleRows
      .filter(r => r.hora_salida_cargar && r.hora_llegada_cargar && r.horas_efectivas <= 0)
      .map(r => ({ numero_remision: r.numero_remision, fecha_servicio: r.fecha_servicio }));

    return {
      fecha_inicio,
      fecha_fin,
      detalle: detalleRows,
      alertas: {
        sin_operario:      sinOperarioRes.rows,
        sin_horas:         sinHorasRes.rows,
        bonificacion_cero: bonCeroRes.rows,
        horas_invalidas:   horasInvalidas,
      },
    };
  }

  /**
   * Resumen de horas totales por operario en un período (quincena anterior).
   * Incluye LIQUIDADA y REALIZADA.
   */
  async getLiquidacionBonificacionPorOperario(fecha_inicio, fecha_fin) {
    const sql = `
      SELECT
        operario_id,
        operario_nombre,
        cedula,
        COALESCE(marca || ' ' || modelo, 'Sin equipo') AS maquina_nombre,
        SUM(horas_efectivas) AS horas_total
      FROM (
        SELECT em.id AS operario_id, em.full_name AS operario_nombre, em.numero_documento AS cedula,
               e.marca, e.modelo,
               CASE
                 WHEN r.hora_salida_cargar IS NOT NULL AND r.hora_llegada_cargar IS NOT NULL THEN
                   CASE
                     WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
                     THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
                     ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
                   END
                 ELSE 0
               END AS horas_efectivas
        FROM remisiones r
        JOIN remision_operarios ro ON ro.remision_id = r.id
        JOIN employees em ON em.id = ro.empleado_id
        LEFT JOIN equipos e ON e.id = r.equipo_id
        WHERE r.deleted_at IS NULL AND r.estado IN ('LIQUIDADA', 'REALIZADA')
          AND r.is_servicio_fijo = false
          AND r.fecha_servicio >= $1 AND r.fecha_servicio <= $2

        UNION ALL

        SELECT em.id AS operario_id, em.full_name AS operario_nombre, em.numero_documento AS cedula,
               e.marca, e.modelo,
               rdf.horas_netas AS horas_efectivas
        FROM remision_dias_fijo rdf
        JOIN remisiones r ON r.id = rdf.remision_id
        JOIN employees em ON em.id = rdf.empleado_id
        LEFT JOIN equipos e ON e.id = r.equipo_id
        WHERE r.deleted_at IS NULL AND r.estado IN ('LIQUIDADA', 'REALIZADA')
          AND rdf.fecha >= $1 AND rdf.fecha <= $2
      ) base
      GROUP BY operario_id, operario_nombre, cedula, marca, modelo
      ORDER BY operario_nombre ASC
    `;
    const result = await query(sql, [fecha_inicio, fecha_fin]);
    return result.rows.map(r => ({
      ...r,
      horas_total: parseFloat(parseFloat(r.horas_total || 0).toFixed(2)),
    }));
  }


  /**
   * Ventas reales vs presupuesto agrupadas por equipo en un rango de fechas.
   * Devuelve [{ nombre, real, presupuesto }] para el gráfico del frontend.
   */
  /**
   * Top 10 clientes/empresas por volumen de ventas en un rango de fechas.
   * Devuelve [{ nombre, total_ventas, total_remisiones }].
   */
  async getTop10Clientes(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`r.fecha_servicio >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`r.fecha_servicio <= $${i++}`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT
        COALESCE(c.name, 'Sin Cliente') AS nombre,
        SUM(r.total_bruto)              AS total_ventas,
        COUNT(r.id)                     AS total_remisiones
      FROM remisiones r
      LEFT JOIN companies c ON c.id = r.company_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.name
      ORDER BY total_ventas DESC
      LIMIT 10
    `;

    const result = await query(sql, params);
    return result.rows.map(r => ({
      nombre:            r.nombre,
      total_ventas:      parseFloat(r.total_ventas || 0),
      total_remisiones:  parseInt(r.total_remisiones || 0),
    }));
  }

  // =============================================
  // MANTENIMIENTO: Órdenes por Estado
  // =============================================
  async getOrdenesPorEstado(fecha_inicio, fecha_fin) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`ot.created_at >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`ot.created_at <= $${i++}::date + interval '1 day'`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT ot.estado, COUNT(*)::int AS cantidad
      FROM ordenes_trabajo ot
      WHERE ${conditions.join(' AND ')}
      GROUP BY ot.estado
      ORDER BY cantidad DESC
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  // =============================================
  // MANTENIMIENTO: Equipos con más Mantenimientos
  // =============================================
  async getEquiposMasMantenimientos(fecha_inicio, fecha_fin) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`ot.created_at >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`ot.created_at <= $${i++}::date + interval '1 day'`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT
        COALESCE(e.marca || ' - ' || COALESCE(e.modelo, e.serie), 'Sin Equipo') AS nombre,
        COUNT(ot.id)::int AS total_ordenes
      FROM ordenes_trabajo ot
      LEFT JOIN equipos e ON e.id = ot.equipo_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.marca, e.modelo, e.serie
      ORDER BY total_ordenes DESC
      LIMIT 10
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  // =============================================
  // MANTENIMIENTO: Distribución por Tipo de Mantenimiento
  // =============================================
  async getTipoMantenimiento(fecha_inicio, fecha_fin) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`ot.created_at >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`ot.created_at <= $${i++}::date + interval '1 day'`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT ot.tipo_mantenimiento AS tipo, COUNT(*)::int AS cantidad
      FROM ordenes_trabajo ot
      WHERE ${conditions.join(' AND ')}
      GROUP BY ot.tipo_mantenimiento
      ORDER BY cantidad DESC
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Ventas reales vs presupuesto mensual del área de Servicios (area_id = 2).
   * Devuelve un punto por mes del rango: [{ mes, real, presupuesto, cumplimiento_pct }].
   */
  async getVentasVsPresupuestoSimple(fecha_inicio, fecha_fin) {
    // 1. Ventas reales agrupadas por mes
    const salesConditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
    const salesParams = [];
    let i = 1;

    if (fecha_inicio) {
      salesConditions.push(`r.fecha_servicio >= $${i++}`);
      salesParams.push(fecha_inicio);
    }
    if (fecha_fin) {
      salesConditions.push(`r.fecha_servicio <= $${i++}`);
      salesParams.push(fecha_fin);
    }

    const salesSql = `
      SELECT
        to_char(date_trunc('month', r.fecha_servicio), 'YYYY-MM') AS mes,
        SUM(r.total_bruto) AS real
      FROM remisiones r
      WHERE ${salesConditions.join(' AND ')}
      GROUP BY date_trunc('month', r.fecha_servicio)
      ORDER BY mes ASC
    `;
    const salesRes = await query(salesSql, salesParams);
    const salesMap = new Map(salesRes.rows.map(r => [r.mes, parseFloat(r.real || 0)]));

    // 2. Presupuesto mensual del área de Servicios (area_id = 2)
    //    Sumamos todos los budget_monthly_detail de equipos de esa área
    const yearFrom  = fecha_inicio ? parseInt(fecha_inicio.substring(0, 4)) : new Date().getFullYear();
    const yearTo    = fecha_fin    ? parseInt(fecha_fin.substring(0, 4))    : new Date().getFullYear();
    const monthFrom = fecha_inicio ? parseInt(fecha_inicio.substring(5, 7)) : 1;
    const monthTo   = fecha_fin    ? parseInt(fecha_fin.substring(5, 7))   : 12;

    const budgetSql = `
      SELECT
        ba.year,
        bmd.month,
        SUM(bmd.amount) AS presupuesto
      FROM budget_monthly_detail bmd
      JOIN budget_equipment be ON be.id = bmd.budget_equipment_id
      JOIN budget_annual ba    ON ba.id = be.budget_annual_id
      JOIN budget_areas  ar    ON ar.id = ba.area_id
      WHERE ar.name ILIKE 'Servicios'
        AND ba.year >= $1 AND ba.year <= $2
        AND (
          (ba.year = $1 AND bmd.month >= $3)
          OR (ba.year > $1 AND ba.year < $2)
          OR (ba.year = $2 AND bmd.month <= $4)
        )
      GROUP BY ba.year, bmd.month
      ORDER BY ba.year ASC, bmd.month ASC
    `;
    const budgetRes = await query(budgetSql, [yearFrom, yearTo, monthFrom, monthTo]);
    const budgetMap = new Map(
      budgetRes.rows.map(r => [
        `${r.year}-${String(r.month).padStart(2, '0')}`,
        parseFloat(r.presupuesto || 0)
      ])
    );

    // 3. Combinar: todos los meses que aparezcan en ventas o presupuesto
    const allMonths = Array.from(
      new Set([...salesMap.keys(), ...budgetMap.keys()])
    ).sort();

    return allMonths.map(mes => {
      const real        = salesMap.get(mes)  || 0;
      const presupuesto = budgetMap.get(mes) || 0;
      const cumplimiento_pct = presupuesto > 0
        ? Math.round((real / presupuesto) * 100)
        : null;
      return { mes, real, presupuesto, cumplimiento_pct };
    });
  }

}

// Utility: format decimal hours to "Xh Ym"
function formatHours(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const informesRepository = new InformesRepository();
