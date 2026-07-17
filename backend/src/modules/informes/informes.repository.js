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

  // =============================================
  // MANTENIMIENTO KPI 4: Ventas Reales vs Presupuesto por Línea de Negocio
  // Real = suma de ot_liquidacion.total_final por tipo (mano_obra / repuestos)
  // Presupuesto = budget_mantenimiento_mensual cruzado con budget_business_lines
  // =============================================
  async getVentasVsPresupuestoMantenimiento(fecha_inicio, fecha_fin) {
    const params = [];
    let i = 1;
    const dateConditions = ["ot.estado = 'LIQUIDADA'", "ot.deleted_at IS NULL"];

    if (fecha_inicio) {
      dateConditions.push(`otl.fecha_liquidacion >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      dateConditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`);
      params.push(fecha_fin);
    }

    // Real: una sola query con SUM(CASE) para evitar duplicar parámetros en UNION ALL
    const realSql = `
      SELECT
        COALESCE(SUM(otl.total_mano_obra), 0)  AS mano_obra_real,
        COALESCE(SUM(otl.total_repuestos),  0)  AS repuestos_real
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ${dateConditions.join(' AND ')}
    `;
    const realRes = await query(realSql, params);

    // Presupuesto: suma de amounts en budget_mantenimiento_mensual filtrado por año/mes
    const dIni = fecha_inicio ? new Date(fecha_inicio + 'T00:00:00') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dFin = fecha_fin    ? new Date(fecha_fin    + 'T00:00:00') : new Date();

    const startYear  = dIni.getFullYear();
    const startMonth = dIni.getMonth() + 1;
    const endYear    = dFin.getFullYear();
    const endMonth   = dFin.getMonth() + 1;

    const budgetSql = `
      SELECT
        bl.nombre AS linea_negocio,
        COALESCE(SUM(bmm.amount), 0) AS total_presupuesto
      FROM budget_business_lines bl
      LEFT JOIN budget_mantenimiento_mensual bmm ON bmm.linea_negocio_id = bl.id
        AND make_date(bmm.year, bmm.month, 1) >= make_date($1, $2, 1)
        AND make_date(bmm.year, bmm.month, 1) <= make_date($3, $4, 1)
      WHERE bl.is_active = true
      GROUP BY bl.id, bl.nombre
      ORDER BY bl.id
    `;
    const budgetRes = await query(budgetSql, [startYear, startMonth, endYear, endMonth]);

    // Combinar en mapa: realRes es 1 sola fila con ambas columnas
    const realRow = realRes.rows[0] || {};
    const dataMap = {
      'Mano de Obra':        { real: parseFloat(realRow.mano_obra_real || 0), presupuesto: 0 },
      'Repuestos o Insumos': { real: parseFloat(realRow.repuestos_real  || 0), presupuesto: 0 },
    };

    budgetRes.rows.forEach(r => {
      if (dataMap[r.linea_negocio] !== undefined) {
        dataMap[r.linea_negocio].presupuesto = parseFloat(r.total_presupuesto || 0);
      }
    });

    return Object.entries(dataMap).map(([linea_negocio, vals]) => ({
      linea_negocio,
      real: vals.real,
      presupuesto: vals.presupuesto,
      cumplimiento_pct: vals.presupuesto > 0
        ? parseFloat(((vals.real / vals.presupuesto) * 100).toFixed(1))
        : null
    }));
  }

  // =============================================
  // MANTENIMIENTO KPI 4.1: Ventas Reales vs Presupuesto Mensual
  // Agrupa ventas y presupuesto por mes
  // =============================================
  async getVentasVsPresupuestoMensualMantenimiento(fecha_inicio, fecha_fin) {
    // 1. Ventas reales agrupadas por mes
    const salesConditions = ["ot.estado = 'LIQUIDADA'", "ot.deleted_at IS NULL"];
    const salesParams = [];
    let i = 1;

    if (fecha_inicio) {
      salesConditions.push(`otl.fecha_liquidacion >= $${i++}::date`);
      salesParams.push(fecha_inicio);
    }
    if (fecha_fin) {
      salesConditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`);
      salesParams.push(fecha_fin);
    }

    const salesSql = `
      SELECT
        to_char(date_trunc('month', otl.fecha_liquidacion), 'YYYY-MM') AS mes,
        COALESCE(SUM(otl.total_mano_obra), 0) + COALESCE(SUM(otl.total_repuestos), 0) AS real
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ${salesConditions.join(' AND ')}
      GROUP BY date_trunc('month', otl.fecha_liquidacion)
      ORDER BY mes ASC
    `;
    const salesRes = await query(salesSql, salesParams);
    const salesMap = new Map(salesRes.rows.map(r => [r.mes, parseFloat(r.real || 0)]));

    // 2. Presupuesto mensual agrupado por año y mes
    const dIni = fecha_inicio ? new Date(fecha_inicio + 'T00:00:00') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dFin = fecha_fin    ? new Date(fecha_fin    + 'T00:00:00') : new Date();

    const startYear  = dIni.getFullYear();
    const startMonth = dIni.getMonth() + 1;
    const endYear    = dFin.getFullYear();
    const endMonth   = dFin.getMonth() + 1;

    const budgetSql = `
      SELECT
        bmm.year,
        bmm.month,
        COALESCE(SUM(bmm.amount), 0) AS presupuesto
      FROM budget_mantenimiento_mensual bmm
      JOIN budget_business_lines bl ON bl.id = bmm.linea_negocio_id
      WHERE bl.is_active = true
        AND make_date(bmm.year, bmm.month, 1) >= make_date($1, $2, 1)
        AND make_date(bmm.year, bmm.month, 1) <= make_date($3, $4, 1)
      GROUP BY bmm.year, bmm.month
      ORDER BY bmm.year ASC, bmm.month ASC
    `;
    const budgetRes = await query(budgetSql, [startYear, startMonth, endYear, endMonth]);
    const budgetMap = new Map(
      budgetRes.rows.map(r => [
        `${r.year}-${String(r.month).padStart(2, '0')}`,
        parseFloat(r.presupuesto || 0)
      ])
    );

    // 3. Combinar meses
    const allMonths = Array.from(
      new Set([...salesMap.keys(), ...budgetMap.keys()])
    ).sort();

    return allMonths.map(mes => {
      const real        = salesMap.get(mes)  || 0;
      const presupuesto = budgetMap.get(mes) || 0;
      const cumplimiento_pct = presupuesto > 0
        ? parseFloat(((real / presupuesto) * 100).toFixed(1))
        : null;
      return { mes, real, presupuesto, cumplimiento_pct };
    });
  }

  // =============================================
  // MANTENIMIENTO KPI 5: Horas Laboradas por Técnico
  // Basado en ot_tecnicos.tiempo_total_min de OTs liquidadas
  // =============================================
  async getHorasTecnicosMantenimiento(fecha_inicio, fecha_fin) {
    const conditions = ["ot.estado = 'LIQUIDADA'", "ot.deleted_at IS NULL"];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`otl.fecha_liquidacion >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT
        em.full_name                                     AS tecnico,
        COUNT(DISTINCT ot.id)                            AS total_ordenes,
        SUM(COALESCE(ott.tiempo_total_min, 0)) / 60.0   AS total_horas
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      JOIN ot_tecnicos    ott ON ott.orden_trabajo_id  = ot.id
      JOIN employees       em ON em.id = ott.empleado_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY em.id, em.full_name
      HAVING SUM(COALESCE(ott.tiempo_total_min, 0)) > 0
      ORDER BY total_horas DESC
    `;
    const result = await query(sql, params);
    return result.rows.map(r => ({
      tecnico:       r.tecnico,
      total_ordenes: parseInt(r.total_ordenes),
      total_horas:   parseFloat(parseFloat(r.total_horas).toFixed(2))
    }));
  }

  // =============================================
  // MANTENIMIENTO KPI 6: Disponibilidad de Flota (Downtime)
  // =============================================
  async getDisponibilidadFlotaMantenimiento(fecha_inicio, fecha_fin) {
    const conditions = ["ot.estado = 'LIQUIDADA'", "ot.deleted_at IS NULL"];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`otl.fecha_liquidacion >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`);
      params.push(fecha_fin);
    }

    const sqlDowntime = `
      SELECT
        COALESCE(e.marca || ' - ' || COALESCE(e.modelo, e.serial), 'Sin Equipo') AS equipo_nombre,
        SUM(
          EXTRACT(EPOCH FROM (otl.fecha_liquidacion - ot.created_at)) / 3600.0
        )::numeric(10,2) AS downtime_horas
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      LEFT JOIN equipos e ON e.id = ot.equipo_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.id, e.marca, e.modelo, e.serial
      ORDER BY downtime_horas DESC
    `;
    const resDowntime = await query(sqlDowntime, params);

    const downtimeData = resDowntime.rows.map(r => ({
      equipo_nombre:  r.equipo_nombre,
      downtime_horas: parseFloat(parseFloat(r.downtime_horas || 0).toFixed(2))
    }));

    // Calcular % disponibilidad global
    const dIni = fecha_inicio ? new Date(fecha_inicio + 'T00:00:00')
                              : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dFin = fecha_fin    ? new Date(fecha_fin + 'T00:00:00') : new Date();
    const diffDays    = Math.max(Math.ceil(Math.abs(dFin - dIni) / (1000 * 60 * 60 * 24)), 1);
    const periodHours = diffDays * 24;

    const resTotalEquipos = await query(`SELECT COUNT(*) AS total FROM equipos WHERE deleted_at IS NULL`);
    const totalEquipos    = Math.max(parseInt(resTotalEquipos.rows[0]?.total || 0), 1);

    const totalDowntime    = downtimeData.reduce((acc, cur) => acc + cur.downtime_horas, 0);
    const horasFlotaTotal  = totalEquipos * periodHours;
    const disponibilidad   = Math.max(
      parseFloat((((horasFlotaTotal - totalDowntime) / horasFlotaTotal) * 100).toFixed(2)),
      0
    );

    return {
      disponibilidad_porcentaje: disponibilidad,
      top_equipos_downtime:      downtimeData.slice(0, 5)
    };
  }

  // =============================================
  // MANTENIMIENTO KPI 7: Costo por Equipo
  // =============================================
  async getCostoPorEquipo(fecha_inicio, fecha_fin, empresa_id) {
    const params = [];
    let i = 1;
    const conditions = ["ot.estado = 'LIQUIDADA'", "ot.deleted_at IS NULL"];

    if (fecha_inicio) {
      conditions.push(`otl.fecha_liquidacion >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`);
      params.push(fecha_fin);
    }
    if (empresa_id) {
      conditions.push(`ot.empresa_id = $${i++}`);
      params.push(empresa_id);
    }

    const sql = `
      SELECT
        e.id AS equipo_id,
        e.marca,
        e.modelo,
        e.serial,
        c.name AS empresa_nombre,
        COALESCE(SUM(otl.total_mano_obra), 0) AS total_mano_obra,
        COALESCE(SUM(otl.total_repuestos), 0) AS total_repuestos,
        COALESCE(SUM(otl.total_mano_obra), 0) + COALESCE(SUM(otl.total_repuestos), 0) AS costo_total
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON ot.id = otl.orden_trabajo_id
      JOIN equipos e ON ot.equipo_id = e.id
      JOIN companies c ON ot.empresa_id = c.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.id, e.marca, e.modelo, e.serial, c.name
      ORDER BY costo_total DESC
    `;

    const res = await query(sql, params);
    return res.rows.map(r => ({
      ...r,
      total_mano_obra: parseFloat(r.total_mano_obra),
      total_repuestos: parseFloat(r.total_repuestos),
      costo_total: parseFloat(r.costo_total)
    }));
  }

  // =============================================
  // MANTENIMIENTO KPI 8: Reincidencia de Fallas
  // =============================================
  async getReincidenciaFallas(fecha_inicio, fecha_fin, empresa_id, dias_ventana = 30) {
    const params = [];
    let i = 1;
    // Solo correctivos liquidado que tengan componente
    const conditions = [
      "ot.estado = 'LIQUIDADA'", 
      "ot.deleted_at IS NULL",
      "ot.tipo_mantenimiento = 'CORRECTIVO'",
      "ot.componente_id IS NOT NULL"
    ];

    if (fecha_inicio) {
      conditions.push(`otl.fecha_liquidacion >= $${i++}::date`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`);
      params.push(fecha_fin);
    }
    if (empresa_id) {
      conditions.push(`ot.empresa_id = $${i++}`);
      params.push(empresa_id);
    }

    // Buscamos todas las OTs correctivas en el periodo
    // y luego agrupamos por equipo_id y componente_id
    const sql = `
      SELECT
        ot.id AS ot_id,
        ot.equipo_id,
        ot.componente_id,
        mc.nombre AS componente_nombre,
        e.marca,
        e.modelo,
        e.serial,
        c.name AS empresa_nombre,
        otl.fecha_liquidacion
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON ot.id = otl.orden_trabajo_id
      JOIN mantenimiento_componentes mc ON ot.componente_id = mc.id
      JOIN equipos e ON ot.equipo_id = e.id
      JOIN companies c ON ot.empresa_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ot.equipo_id, ot.componente_id, otl.fecha_liquidacion ASC
    `;

    const res = await query(sql, params);
    const OTs = res.rows;
    
    // Total de ordenes evaluadas
    const total_ordenes_correctivas = OTs.length;
    let ordenes_reincidentes_count = 0;
    const casos_reincidencia = [];

    // Agrupar por equipo + componente
    const grupos = {};
    for (const ot of OTs) {
      const key = `${ot.equipo_id}_${ot.componente_id}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(ot);
    }

    for (const key in grupos) {
      const historial = grupos[key];
      // Evaluamos pares consecutivos
      for (let j = 1; j < historial.length; j++) {
        const prev = historial[j - 1];
        const curr = historial[j];
        
        const diffMs = new Date(curr.fecha_liquidacion) - new Date(prev.fecha_liquidacion);
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDias <= dias_ventana) {
          // Es una reincidencia
          ordenes_reincidentes_count++;
          casos_reincidencia.push({
            equipo: `${curr.marca} ${curr.modelo} (${curr.serial})`,
            empresa: curr.empresa_nombre,
            componente: curr.componente_nombre,
            ot_anterior_id: prev.ot_id,
            ot_actual_id: curr.ot_id,
            fecha_anterior: prev.fecha_liquidacion,
            fecha_actual: curr.fecha_liquidacion,
            dias_transcurridos: diffDias
          });
        }
      }
    }

    const reincidencia_pct = total_ordenes_correctivas > 0 
      ? ((ordenes_reincidentes_count / total_ordenes_correctivas) * 100).toFixed(1)
      : 0;

    return {
      total_ordenes_correctivas,
      ordenes_reincidentes_count,
      reincidencia_pct: parseFloat(reincidencia_pct),
      casos: casos_reincidencia
    };
  }
}

// Utility: format decimal hours to "Xh Ym"
function formatHours(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const informesRepository = new InformesRepository();
