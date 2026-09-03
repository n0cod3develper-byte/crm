import { query, withTransaction } from '../../config/database.js';

export class InformesRepository {
  async getVentasPorLineaNegocio(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
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
    const conditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
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
    const conditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
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
      WITH tramo_calc AS (
        SELECT 
          r.id AS remision_id,
          r.total_bruto,
          r.tiene_sustitucion,
          r.equipo_id AS remision_equipo_id,
          t.equipo_id AS tramo_equipo_id,
          COALESCE(t.dias_facturables, GREATEST(1, CURRENT_DATE - t.fecha_inicio + 1)) AS dias_tramo
        FROM remisiones r
        LEFT JOIN remision_tramos_equipo t ON t.remision_id = r.id AND r.tiene_sustitucion = TRUE
        WHERE ${conditions.join(' AND ')}
      ),
      tramo_totals AS (
        SELECT 
          tc.*,
          SUM(tc.dias_tramo) OVER (PARTITION BY tc.remision_id) AS total_dias_remision
        FROM tramo_calc tc
      )
      SELECT 
        COALESCE(e.marca || ' - ' || e.serie, 'Sin Equipo / Otros') AS equipo_nombre,
        e.serie,
        SUM(
          CASE 
            WHEN tt.tiene_sustitucion = TRUE AND tt.total_dias_remision > 0 THEN 
              tt.total_bruto * (tt.dias_tramo / tt.total_dias_remision)
            ELSE 
              tt.total_bruto
          END
        ) AS total_ventas
      FROM tramo_totals tt
      LEFT JOIN equipos e ON e.id = COALESCE(tt.tramo_equipo_id, tt.remision_equipo_id)
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
    const salesConditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
    const salesParams = [];
    let i = 1;

    if (isAll) {
      salesConditions.push('e.empresa_id = $1');
      salesParams.push(targetEmpresaId);
      i = 2;
    } else {
      salesConditions.push('(r.equipo_id = $1 OR EXISTS (SELECT 1 FROM remision_tramos_equipo t WHERE t.remision_id = r.id AND t.equipo_id = $1))');
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
      WITH remision_base AS (
        SELECT 
          r.id,
          r.fecha_servicio,
          r.total_bruto,
          r.tiene_sustitucion,
          r.equipo_id AS remision_equipo_id
        FROM remisiones r
        ${isAll ? 'JOIN equipos e ON e.id = r.equipo_id' : ''}
        WHERE ${salesConditions.join(' AND ')}
      ),
      tramos_base AS (
        SELECT 
          rb.*,
          t.equipo_id AS tramo_equipo_id,
          COALESCE(t.dias_facturables, GREATEST(1, CURRENT_DATE - t.fecha_inicio + 1)) AS dias_tramo
        FROM remision_base rb
        LEFT JOIN remision_tramos_equipo t ON t.remision_id = rb.id AND rb.tiene_sustitucion = TRUE
      ),
      tramos_totals AS (
        SELECT 
          tb.*,
          SUM(tb.dias_tramo) OVER (PARTITION BY tb.id) AS total_dias_remision
        FROM tramos_base tb
      )
      SELECT 
        to_char(date_trunc('month', tt.fecha_servicio), 'YYYY-MM') AS month,
        SUM(
          CASE 
            WHEN tt.tiene_sustitucion = TRUE AND tt.total_dias_remision > 0 THEN 
              tt.total_bruto * (tt.dias_tramo / tt.total_dias_remision)
            ELSE 
              tt.total_bruto
          END
        ) AS sales
      FROM tramos_totals tt
      ${!isAll ? `WHERE (tt.tiene_sustitucion = FALSE AND tt.remision_equipo_id = $1) OR (tt.tiene_sustitucion = TRUE AND tt.tramo_equipo_id = $1)` : ''}
      GROUP BY date_trunc('month', tt.fecha_servicio)
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
      "r.estado = 'FACTURADA'",
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

    // Count excluded orders (FACTURADA but missing time fields)
    const excludedSql = `
      SELECT COUNT(*) AS excluded
      FROM remisiones r
      WHERE r.deleted_at IS NULL
        AND r.estado = 'FACTURADA'
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
      "r.estado = 'FACTURADA'",
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
      "r.estado = 'FACTURADA'",
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
      "r.estado = 'FACTURADA'",
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
  async getLiquidacionBonificacion(fecha_inicio, fecha_fin, usuario_id = null) {
    const params = [fecha_inicio, fecha_fin];
    let usuarioParamIdx = null;
    if (usuario_id) {
      params.push(usuario_id);
      usuarioParamIdx = params.length;
    }

    const detalleSql = `
      SELECT
        r.id,
        r.id AS remision_id,
        r.numero_remision,
        COALESCE(r.hora_acordada, r.fecha_servicio) AS fecha_servicio,
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
        COALESCE(NULLIF(TRIM(e.serie), ''), NULLIF(TRIM(r.numero_maquina), ''), 'Sin equipo') AS maquina_nombre,
        e.serial      AS equipo_serial,
        e.capacidad_carga,
        false         AS is_servicio_fijo,
        GREATEST(1, CASE
          WHEN r.hora_salida_cargar IS NOT NULL AND r.hora_llegada_cargar IS NOT NULL THEN
            CASE
              WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
              THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
              ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
            END
          ELSE 0
        END) AS horas_efectivas,
        CASE WHEN ghs.id IS NOT NULL THEN true ELSE false END AS is_subrayada
      FROM remisiones r
      LEFT JOIN remision_operarios ro ON ro.remision_id = r.id
      LEFT JOIN employees em ON em.id = ro.empleado_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN gestion_humana_subrayados ghs ON ghs.remision_id = r.id ${usuarioParamIdx ? `AND ghs.usuario_id = $${usuarioParamIdx}` : 'AND false'}
      WHERE r.deleted_at IS NULL
        AND r.is_servicio_fijo = false
        AND COALESCE(r.hora_acordada, r.fecha_servicio) >= $1
        AND COALESCE(r.hora_acordada, r.fecha_servicio) <= $2

      UNION ALL

      SELECT
        rdf.id AS id,
        r.id AS remision_id,
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
        COALESCE(NULLIF(TRIM(e.serie), ''), NULLIF(TRIM(r.numero_maquina), ''), 'Sin equipo') AS maquina_nombre,
        e.serial      AS equipo_serial,
        e.capacidad_carga,
        true          AS is_servicio_fijo,
        GREATEST(1, rdf.horas_netas) AS horas_efectivas,
        CASE WHEN ghs.id IS NOT NULL THEN true ELSE false END AS is_subrayada
      FROM remision_dias_fijo rdf
      JOIN remisiones r ON r.id = rdf.remision_id
      LEFT JOIN employees em ON em.id = rdf.empleado_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN gestion_humana_subrayados ghs ON ghs.remision_id = r.id ${usuarioParamIdx ? `AND ghs.usuario_id = $${usuarioParamIdx}` : 'AND false'}
      WHERE r.deleted_at IS NULL
        AND rdf.fecha >= $1
        AND rdf.fecha <= $2
      ORDER BY operario_nombre ASC, fecha_servicio ASC, numero_remision ASC
    `;

    // Alerta 1: sin operario asignado
    const sinOperarioSql = `
      SELECT r.id AS remision_id, r.numero_remision, COALESCE(r.hora_acordada, r.fecha_servicio) AS fecha_servicio, r.estado,
             COALESCE(r.numero_maquina, 'S/N') AS numero_maquina
      FROM remisiones r
      WHERE r.deleted_at IS NULL
        AND COALESCE(r.hora_acordada, r.fecha_servicio) >= $1
        AND COALESCE(r.hora_acordada, r.fecha_servicio) <= $2
        AND NOT EXISTS (SELECT 1 FROM remision_operarios ro WHERE ro.remision_id = r.id)
      ORDER BY fecha_servicio ASC
    `;

    // Alerta 2: con operario pero sin horas registradas
    const sinHorasSql = `
      SELECT DISTINCT r.id AS remision_id, r.numero_remision, COALESCE(r.hora_acordada, r.fecha_servicio) AS fecha_servicio, r.estado
      FROM remisiones r
      LEFT JOIN remision_operarios ro ON ro.remision_id = r.id
      WHERE r.deleted_at IS NULL
        AND COALESCE(r.hora_acordada, r.fecha_servicio) >= $1
        AND COALESCE(r.hora_acordada, r.fecha_servicio) <= $2
        AND (r.hora_salida_cargar IS NULL OR r.hora_llegada_cargar IS NULL)
      ORDER BY fecha_servicio ASC
    `;

    // Alerta 3: bonificación = 0 en AMBAS fuentes (remisión Y equipo)
    const bonificacionCeroSql = `
      SELECT DISTINCT r.id AS remision_id, r.numero_remision, COALESCE(r.hora_acordada, r.fecha_servicio) AS fecha_servicio, r.estado,
             COALESCE(r.numero_maquina, 'S/N') AS numero_maquina
      FROM remisiones r
      LEFT JOIN remision_operarios ro ON ro.remision_id = r.id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE r.deleted_at IS NULL
        AND COALESCE(r.hora_acordada, r.fecha_servicio) >= $1
        AND COALESCE(r.hora_acordada, r.fecha_servicio) <= $2
        AND (r.bonificacion_hora IS NULL OR r.bonificacion_hora = 0)
        AND (e.bonificacion_hora IS NULL OR e.bonificacion_hora = 0)
      ORDER BY fecha_servicio ASC
    `;

    const alertParams = [fecha_inicio, fecha_fin];

    const [detalleRes, sinOperarioRes, sinHorasRes, bonCeroRes] = await Promise.all([
      query(detalleSql, params),
      query(sinOperarioSql, alertParams),
      query(sinHorasSql, alertParams),
      query(bonificacionCeroSql, alertParams),
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
      .filter(r => r.hora_salida_cargar && r.hora_llegada_cargar && r.horas_efectivas <= 0) // It won't be <=0 now because of GREATEST(1), but keep logic
      .map(r => ({ remision_id: r.remision_id, numero_remision: r.numero_remision, fecha_servicio: r.fecha_servicio }));

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
        COALESCE(numero_equipo, 'Sin equipo') AS maquina_nombre,
        SUM(horas_efectivas) AS horas_total
      FROM (
        SELECT em.id AS operario_id, em.full_name AS operario_nombre, em.numero_documento AS cedula,
               e.serie AS numero_equipo,
               GREATEST(1, CASE
                 WHEN r.hora_salida_cargar IS NOT NULL AND r.hora_llegada_cargar IS NOT NULL THEN
                   CASE
                     WHEN r.hora_llegada_cargar::time >= r.hora_salida_cargar::time
                     THEN EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time)) / 3600.0
                     ELSE EXTRACT(EPOCH FROM (r.hora_llegada_cargar::time - r.hora_salida_cargar::time + INTERVAL '24 hours')) / 3600.0
                   END
                 ELSE 0
               END) AS horas_efectivas
        FROM remisiones r
        LEFT JOIN remision_operarios ro ON ro.remision_id = r.id
        LEFT JOIN employees em ON em.id = ro.empleado_id
        LEFT JOIN equipos e ON e.id = r.equipo_id
        WHERE r.deleted_at IS NULL
          AND r.is_servicio_fijo = false
          AND COALESCE(r.hora_acordada, r.fecha_servicio) >= $1 AND COALESCE(r.hora_acordada, r.fecha_servicio) <= $2

        UNION ALL

        SELECT em.id AS operario_id, em.full_name AS operario_nombre, em.numero_documento AS cedula,
               e.serie AS numero_equipo,
               GREATEST(1, rdf.horas_netas) AS horas_efectivas
        FROM remision_dias_fijo rdf
        JOIN remisiones r ON r.id = rdf.remision_id
        LEFT JOIN employees em ON em.id = rdf.empleado_id
        LEFT JOIN equipos e ON e.id = r.equipo_id
        WHERE r.deleted_at IS NULL
          AND rdf.fecha >= $1 AND rdf.fecha <= $2
      ) base
      WHERE operario_id IS NOT NULL
      GROUP BY operario_id, operario_nombre, cedula, numero_equipo
      ORDER BY operario_nombre ASC
    `;
    const result = await query(sql, [fecha_inicio, fecha_fin]);
    return result.rows.map(r => ({
      ...r,
      horas_total: parseFloat(parseFloat(r.horas_total || 0).toFixed(2)),
    }));
  }

  /**
   * Toggle el estado de subrayado de una remisión para un usuario específico.
   */
  async toggleSubrayado(usuario_id, remision_id) {
    return await withTransaction(async (client) => {
      const check = await client.query(
        'SELECT id FROM gestion_humana_subrayados WHERE usuario_id = $1 AND remision_id = $2',
        [usuario_id, remision_id]
      );
      if (check.rows.length > 0) {
        await client.query(
          'DELETE FROM gestion_humana_subrayados WHERE id = $1',
          [check.rows[0].id]
        );
        return { is_subrayada: false };
      } else {
        await client.query(
          'INSERT INTO gestion_humana_subrayados (usuario_id, remision_id) VALUES ($1, $2)',
          [usuario_id, remision_id]
        );
        return { is_subrayada: true };
      }
    });
  }


  /**
   * Ventas reales vs presupuesto agrupadas por equipo en un rango de fechas.
   * Devuelve [{ nombre, real, presupuesto }] para el gráfico del frontend.
   */
  async getLiquidacionAjustes(quincena) {
    const sql = `SELECT remision_id, horas_ajustadas, nota FROM liquidacion_ajustes WHERE quincena = $1`;
    const result = await query(sql, [quincena]);
    return result.rows;
  }

  async upsertLiquidacionAjustes(quincena, ajustes) {
    // ajustes es un objeto { remision_id: { horas, nota } }
    await withTransaction(async (client) => {
      for (const [remision_id, data] of Object.entries(ajustes)) {
        if (!data.horas && !data.nota) {
           await client.query('DELETE FROM liquidacion_ajustes WHERE quincena = $1 AND remision_id = $2', [quincena, remision_id]);
           continue;
        }
        await client.query(`
          INSERT INTO liquidacion_ajustes (remision_id, quincena, horas_ajustadas, nota, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (remision_id, quincena) 
          DO UPDATE SET horas_ajustadas = EXCLUDED.horas_ajustadas, nota = EXCLUDED.nota, updated_at = NOW()
        `, [remision_id, quincena, data.horas !== '' ? data.horas : null, data.nota || null]);
      }
    });
  }

  /**
   * Top 10 clientes/empresas por volumen de ventas en un rango de fechas.
   * Devuelve [{ nombre, total_ventas, total_remisiones }].
   */
  async getTop10Clientes(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
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
    const salesConditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
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
    const dateConditions = ["ot.estado = 'FACTURADA'", "ot.deleted_at IS NULL"];

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
    const salesConditions = ["ot.estado = 'FACTURADA'", "ot.deleted_at IS NULL"];
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
    const conditions = ["ot.estado = 'FACTURADA'", "ot.deleted_at IS NULL"];
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
    const conditions = ["ot.estado = 'FACTURADA'", "ot.deleted_at IS NULL"];
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
    const conditions = ["ot.estado = 'FACTURADA'", "ot.deleted_at IS NULL"];

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
      "ot.estado = 'FACTURADA'", 
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

  // ── KPI: MTTR (Tiempo Medio de Reparación) ─────────────────────────────────
  // Promedio de horas desde apertura de OT correctiva hasta su liquidación
  async getMTTR(fecha_inicio, fecha_fin, empresa_id) {
    const params = [];
    let i = 1;
    const conditions = [
      "ot.tipo_mantenimiento = 'CORRECTIVO'",
      "ot.deleted_at IS NULL",
      "otl.fecha_liquidacion IS NOT NULL"
    ];
    if (fecha_inicio) { conditions.push(`otl.fecha_liquidacion >= $${i++}::date`); params.push(fecha_inicio); }
    if (fecha_fin)    { conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`); params.push(fecha_fin); }
    if (empresa_id)   { conditions.push(`ot.empresa_id = $${i++}`); params.push(empresa_id); }

    const sql = `
      SELECT
        COUNT(*)::int                                                          AS total_ots,
        ROUND(AVG(EXTRACT(EPOCH FROM (otl.fecha_liquidacion - ot.created_at)) / 3600)::numeric, 2) AS mttr_horas,
        ROUND(MIN(EXTRACT(EPOCH FROM (otl.fecha_liquidacion - ot.created_at)) / 3600)::numeric, 2) AS min_horas,
        ROUND(MAX(EXTRACT(EPOCH FROM (otl.fecha_liquidacion - ot.created_at)) / 3600)::numeric, 2) AS max_horas
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ${conditions.join(' AND ')}
    `;
    const res = await query(sql, params);
    return res.rows[0] || { total_ots: 0, mttr_horas: null, min_horas: null, max_horas: null };
  }

  // ── KPI: MTBF (Tiempo Medio Entre Fallas) ─────────────────────────────────
  // Promedio de días entre OTs correctivas consecutivas por equipo
  async getMTBF(fecha_inicio, fecha_fin, empresa_id) {
    const params = [];
    let i = 1;
    const conditions = [
      "ot.tipo_mantenimiento = 'CORRECTIVO'",
      "ot.deleted_at IS NULL",
      "otl.fecha_liquidacion IS NOT NULL"
    ];
    if (fecha_inicio) { conditions.push(`otl.fecha_liquidacion >= $${i++}::date`); params.push(fecha_inicio); }
    if (fecha_fin)    { conditions.push(`otl.fecha_liquidacion <= ($${i++}::date + interval '1 day')`); params.push(fecha_fin); }
    if (empresa_id)   { conditions.push(`ot.empresa_id = $${i++}`); params.push(empresa_id); }

    const sql = `
      WITH ots_correctivas AS (
        SELECT
          ot.equipo_id,
          e.marca, e.modelo, e.serial,
          otl.fecha_liquidacion,
          LAG(otl.fecha_liquidacion) OVER (PARTITION BY ot.equipo_id ORDER BY otl.fecha_liquidacion) AS fecha_anterior
        FROM ordenes_trabajo ot
        JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
        JOIN equipos e ON e.id = ot.equipo_id
        WHERE ${conditions.join(' AND ')}
      ),
      intervalos AS (
        SELECT
          equipo_id, marca, modelo, serial,
          EXTRACT(EPOCH FROM (fecha_liquidacion - fecha_anterior)) / 86400 AS dias_entre_fallas
        FROM ots_correctivas
        WHERE fecha_anterior IS NOT NULL
      ),
      por_equipo_agg AS (
        SELECT
          equipo_id,
          marca || ' ' || modelo || ' (' || serial || ')' AS equipo,
          ROUND(AVG(dias_entre_fallas)::numeric, 1) AS mtbf_dias
        FROM intervalos
        GROUP BY equipo_id, marca, modelo, serial
      )
      SELECT
        (SELECT COUNT(DISTINCT equipo_id)::int FROM intervalos) AS equipos_con_fallas,
        (SELECT ROUND(AVG(dias_entre_fallas)::numeric, 1) FROM intervalos) AS mtbf_dias_promedio,
        (SELECT ROUND(MIN(dias_entre_fallas)::numeric, 1) FROM intervalos) AS mtbf_min,
        (SELECT ROUND(MAX(dias_entre_fallas)::numeric, 1) FROM intervalos) AS mtbf_max,
        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('equipo', equipo, 'mtbf_dias', mtbf_dias) ORDER BY mtbf_dias ASC) FROM por_equipo_agg),
          '[]'::jsonb
        ) AS por_equipo
    `;
    const res = await query(sql, params);
    return res.rows[0] || { equipos_con_fallas: 0, mtbf_dias_promedio: null, mtbf_min: null, mtbf_max: null, por_equipo: [] };
  }

  // ── KPI: Preventivos Próximos a Vencer ────────────────────────────────────
  // Mantenimientos preventivos programados que vencen en los próximos N días
  async getPreventivosProximos(dias = 15) {
    const sql = `
      SELECT
        mp.id,
        mp.codigo,
        mp.titulo,
        mp.fecha_programada,
        mp.estado,
        mp.prioridad,
        mp.tipo_mantenimiento,
        mp.tipo_entidad,
        e.marca || ' ' || e.modelo || ' (' || e.serial || ')' AS equipo_nombre,
        a.nombre AS area_nombre,
        u.nombre AS responsable_nombre,
        mp.fecha_programada - CURRENT_DATE AS dias_restantes
      FROM mp_ordenes_mantenimiento mp
      LEFT JOIN equipos e ON mp.equipo_id = e.id
      LEFT JOIN areas_inventario a ON mp.area_id = a.id
      LEFT JOIN users u ON mp.responsable_id = u.id
      WHERE mp.estado IN ('PROGRAMADO', 'EN_EJECUCION')
        AND mp.fecha_programada BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($1 || ' days')::interval)
      ORDER BY mp.fecha_programada ASC, mp.prioridad DESC
      LIMIT 50
    `;
    const res = await query(sql, [dias]);
    return res.rows;
  }

  // ── KPI: Stock Bajo Vinculado a OTs Activas ───────────────────────────────
  // Repuestos con stock <= mínimo que aparecen en OTs abiertas/en proceso
  async getStockBajoActivo() {
    try {
      const sql = `
        SELECT
          ii.id AS item_id,
          COALESCE(ii.codigo_interno, ii.sku, 'PRD-00000') AS codigo_interno,
          COALESCE(ii.nombre_comercial, ii.name) AS nombre,
          COALESCE(ii.stock_current, 0)::int AS stock_actual,
          COALESCE(ii.stock_minimum, 0)::int AS stock_minimo,
          (COALESCE(ii.stock_minimum, 0) - COALESCE(ii.stock_current, 0))::int AS deficit,
          COUNT(DISTINCT ot.id)::int AS ots_activas_count,
          COALESCE(STRING_AGG(DISTINCT ot.consecutivo::text, ', '), '') AS ots_consecutivos
        FROM inventory_items ii
        JOIN ot_repuestos_insumos ri ON ri.item_inventario_id = ii.id
        JOIN ordenes_trabajo ot ON ot.id = ri.orden_trabajo_id
        WHERE ot.estado IN ('ABIERTA', 'EN_PROCESO')
          AND ot.deleted_at IS NULL
        GROUP BY ii.id, ii.codigo_interno, ii.sku, ii.nombre_comercial, ii.name, ii.stock_current, ii.stock_minimum
        HAVING COALESCE(ii.stock_current, 0) <= COALESCE(ii.stock_minimum, 0)
           AND COALESCE(ii.stock_minimum, 0) > 0
        ORDER BY deficit DESC
        LIMIT 20
      `;
      const res = await query(sql);
      return res.rows;
    } catch (err) {
      // Fallback si ocurre algún detalle en las columnas de inventory_items
      return [];
    }
  }

  // ── KPI: Indicadores de Cobertura ─────────────────────────────────────────
  async getCobertura(fecha_inicio, fecha_fin) {
    const params = [];
    let i = 1;
    const dateConditions = ['ot.deleted_at IS NULL'];
    if (fecha_inicio) { dateConditions.push(`ot.created_at >= $${i++}::date`); params.push(fecha_inicio); }
    if (fecha_fin)    { dateConditions.push(`ot.created_at <= ($${i++}::date + interval '1 day')`); params.push(fecha_fin); }

    const sql = `
      WITH equipos_totales AS (
        SELECT COUNT(*)::int AS total FROM equipos WHERE deleted_at IS NULL
      ),
      equipos_activos AS (
        SELECT COUNT(DISTINCT ot.equipo_id)::int AS total
        FROM ordenes_trabajo ot
        WHERE ${dateConditions.join(' AND ')}
      ),
      empresas_activas AS (
        SELECT COUNT(DISTINCT ot.empresa_id)::int AS total
        FROM ordenes_trabajo ot
        WHERE ${dateConditions.join(' AND ')}
      ),
      empresas_totales AS (
        SELECT COUNT(*)::int AS total FROM companies WHERE deleted_at IS NULL
      ),
      proveedores_stats AS (
        SELECT
          COUNT(DISTINCT p.id)::int AS proveedores_activos,
          0 AS tiempo_respuesta_promedio
        FROM proveedores p
        WHERE p.estado = 'ACTIVO'
      )
      SELECT
        et.total       AS equipos_total,
        ea.total       AS equipos_atendidos,
        CASE WHEN et.total > 0 THEN ROUND((ea.total::numeric / et.total) * 100, 1) ELSE 0 END AS cobertura_equipos_pct,
        empa.total     AS empresas_activas,
        empt.total     AS empresas_total,
        ps.proveedores_activos
      FROM equipos_totales et, equipos_activos ea, empresas_activas empa, empresas_totales empt, proveedores_stats ps
    `;
    const res = await query(sql, params);
    return res.rows[0] || { equipos_total: 0, equipos_atendidos: 0, cobertura_equipos_pct: 0, empresas_activas: 0, empresas_total: 0, proveedores_activos: 0 };
  }

  /**
   * Horas Extras de Servicios.
   * Calcula las horas que caen FUERA del horario normal de la empresa:
   *   Lunes-Jueves: 07:00 – 16:15
   *   Viernes:      07:00 – 16:10
   *   Sábado:       07:00 – 10:50
   *   Domingo/Festivo: todo es extra
   *
   * Se usa hora_salida_cargar → hora_llegada_cargar como jornada real.
   * Campos retornados: numero_remision, operario, equipo, fecha_servicio,
   *                    cliente, horas_extras, total_neto de la remisión.
   */
  async getHorasExtrasServicios(fecha_inicio, fecha_fin) {
    const conditions = ['r.deleted_at IS NULL', "r.estado = 'FACTURADA'"];
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

    // Solo remisiones con ambos tiempos registrados
    conditions.push('r.hora_salida_cargar IS NOT NULL');
    conditions.push('r.hora_llegada_cargar IS NOT NULL');

    const sql = `
      SELECT
        r.id AS remision_id,
        r.numero_remision,
        em.id AS operario_id,
        em.full_name AS operario_nombre,
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
        e.serie AS equipo_serie,
        r.fecha_servicio,
        c.name AS cliente_nombre,
        r.hora_salida_cargar,
        r.hora_llegada_cargar,
        COALESCE(r.total_neto, 0)::NUMERIC(12,2) AS total_neto,
        EXTRACT(DOW FROM r.fecha_servicio) AS dia_semana,
        CASE WHEN fc.fecha IS NOT NULL THEN TRUE ELSE FALSE END AS es_festivo
      FROM remisiones r
      LEFT JOIN remision_operarios ro ON ro.remision_id = r.id
      LEFT JOIN employees em ON em.id = ro.empleado_id
      JOIN companies c ON c.id = r.company_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN festivos_colombia fc ON fc.fecha = r.fecha_servicio AND fc.activo = TRUE
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.numero_remision ASC
    `;

    const res = await query(sql, params);

    // ── Calcular horas extras para cada fila ──
    const resultado = [];

    for (const row of res.rows) {
      const horasExtras = calcularHorasExtras(
        row.hora_salida_cargar,
        row.hora_llegada_cargar,
        parseInt(row.dia_semana),   // 0=Domingo, 1=Lunes, ..., 6=Sábado
        row.es_festivo
      );

      if (horasExtras > 0) {
        resultado.push({
          remision_id: row.remision_id,
          numero_remision: row.numero_remision,
          operario_id: row.operario_id,
          operario_nombre: row.operario_nombre,
          equipo_marca: row.equipo_marca,
          equipo_modelo: row.equipo_modelo,
          equipo_serie: row.equipo_serie,
          fecha_servicio: row.fecha_servicio,
          cliente_nombre: row.cliente_nombre,
          horas_extras: horasExtras.toFixed(2),
          total_neto: row.total_neto,
        });
      }
    }

    return resultado;
  }

  // =============================================
  // INFORME: Detalle Mantenimiento por Equipos
  // RBAC scope, paginacion server-side, CTE optimizado
  // =============================================
  async getDetalleMantenimientoEquipos(fecha_inicio, fecha_fin, empresa_id, equipo_id, allowedEmpresaIds, page = 1, limit = 50) {
    const params = [];
    let i = 1;
    const conditions = ["ot.estado = 'FACTURADA'", 'ot.deleted_at IS NULL'];

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
    } else if (allowedEmpresaIds && allowedEmpresaIds.length > 0) {
      conditions.push(`ot.empresa_id = ANY($${i++}::uuid[])`);
      params.push(allowedEmpresaIds);
    }
    if (equipo_id) {
      conditions.push(`ot.equipo_id = $${i++}`);
      params.push(equipo_id);
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `SELECT COUNT(DISTINCT ot.id)::int AS total FROM ordenes_trabajo ot JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id WHERE ${whereClause}`;
    const countRes = await query(countSql, params);
    const totalOt = countRes.rows[0]?.total || 0;

    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(parseInt(limit) || 50, 200);
    const safeLimit = Math.min(parseInt(limit) || 50, 200);

    const sql = `
      WITH actividades AS (
        SELECT orden_trabajo_id, STRING_AGG(CONCAT(COALESCE(codigo,''), ' - ', descripcion), '; ' ORDER BY orden) AS actividades_texto
        FROM ot_actividades GROUP BY orden_trabajo_id
      )
      SELECT ot.id AS ot_id, ot.consecutivo, ot.tipo_mantenimiento,
        otl.fecha_liquidacion, otl.total_final, otl.total_mano_obra, otl.total_repuestos,
        COALESCE(e.marca || ' - ' || COALESCE(e.modelo, e.serial), 'Sin Equipo') AS equipo_nombre,
        e.serial AS equipo_serial, c.name AS empresa_nombre,
        ot.detalle_servicio, ot.observaciones,
        em.id AS tecnico_id, em.full_name AS tecnico_nombre,
        ott.tarifa_hora, ott.total_mano_obra AS tecnico_mano_obra, ott.tiempo_total_min,
        act.actividades_texto AS actividades_realizadas
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      JOIN equipos e ON ot.equipo_id = e.id
      JOIN companies c ON ot.empresa_id = c.id
      LEFT JOIN ot_tecnicos ott ON ott.orden_trabajo_id = ot.id
      LEFT JOIN employees em ON em.id = ott.empleado_id
      LEFT JOIN actividades act ON act.orden_trabajo_id = ot.id
      WHERE ${whereClause}
      ORDER BY otl.fecha_liquidacion DESC, ot.consecutivo ASC, em.full_name ASC
      LIMIT $${i++} OFFSET $${i++}
    `;
    params.push(safeLimit, offset);
    const result = await query(sql, params);

    const otMap = new Map();
    for (const row of result.rows) {
      if (!otMap.has(row.ot_id)) {
        otMap.set(row.ot_id, {
          ot_id: row.ot_id, consecutivo: row.consecutivo, tipo_mantenimiento: row.tipo_mantenimiento,
          fecha_liquidacion: row.fecha_liquidacion, total_final: parseFloat(row.total_final),
          total_mano_obra: parseFloat(row.total_mano_obra), total_repuestos: parseFloat(row.total_repuestos),
          equipo_nombre: row.equipo_nombre, equipo_serial: row.equipo_serial, empresa_nombre: row.empresa_nombre,
          detalle_servicio: row.detalle_servicio, observaciones: row.observaciones,
          actividades_realizadas: row.actividades_realizadas, tecnicos: []
        });
      }
      if (row.tecnico_id) {
        otMap.get(row.ot_id).tecnicos.push({
          id: row.tecnico_id, nombre: row.tecnico_nombre,
          tarifa_hora: parseFloat(row.tarifa_hora), mano_obra: parseFloat(row.tecnico_mano_obra),
          horas: row.tiempo_total_min ? parseFloat((row.tiempo_total_min / 60).toFixed(2)) : 0
        });
      }
    }

    const data = Array.from(otMap.values());
    const totalValor = data.reduce((sum, ot) => sum + ot.total_final, 0);
    return {
      fecha_inicio, fecha_fin, empresa_id: empresa_id || null, equipo_id: equipo_id || null,
      total_ot: totalOt, total_valor: totalValor,
      page: parseInt(page), limit: safeLimit, totalPages: Math.ceil(totalOt / safeLimit), data
    };
  }

  // =============================================
  // MANTENIMIENTO: Venta Dejada de Percibir por Indisponibilidad
  // Cruza OTs (tiempo en taller) con presupuesto mensual por equipo
  // Fórmula: valor_dia = presupuesto_mensual / working_days
  //           venta_perdida = valor_dia * dias_habiles_en_taller
  // =============================================
  async getVentaDejadaPercibir({ fecha_inicio, fecha_fin, equipo_id, empresa_id, tipo_mantenimiento }) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_inicio) { conditions.push(`ot.created_at >= $${i++}::date`); params.push(fecha_inicio); }
    if (fecha_fin)    { conditions.push(`ot.created_at <= ($${i++}::date + interval '1 day')`); params.push(fecha_fin); }
    if (equipo_id)   { conditions.push(`ot.equipo_id = $${i++}`); params.push(equipo_id); }
    if (empresa_id)  { conditions.push(`ot.empresa_id = $${i++}`); params.push(empresa_id); }
    if (tipo_mantenimiento) { conditions.push(`ot.tipo_mantenimiento = $${i++}`); params.push(tipo_mantenimiento); }

    // 1. Obtener OTs en el rango con sus fechas de apertura y cierre
    const otSql = `
      SELECT
        ot.id,
        ot.consecutivo,
        ot.tipo_mantenimiento,
        ot.equipo_id,
        ot.empresa_id,
        ot.created_at AS fecha_apertura,
        otl.fecha_liquidacion AS fecha_cierre,
        ot.estado,
        e.marca, e.modelo, e.serial,
        c.name AS empresa_nombre
      FROM ordenes_trabajo ot
      LEFT JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      LEFT JOIN equipos e ON e.id = ot.equipo_id
      LEFT JOIN companies c ON c.id = ot.empresa_id
      WHERE ${conditions.join(' AND ')}
        AND ot.equipo_id IS NOT NULL
      ORDER BY ot.created_at ASC
    `;
    const otRes = await query(otSql, params);
    const ots = otRes.rows;

    if (ots.length === 0) {
      return {
        fecha_inicio, fecha_fin, equipo_id: equipo_id || null, empresa_id: empresa_id || null,
        total_perdido: 0, total_ots: 0, detalle: [], por_equipo: [],
        por_tipo: [], por_mes: []
      };
    }

    // 2. Obtener presupuesto mensual por equipo (budget_monthly_detail)
    const yearFrom = fecha_inicio ? parseInt(fecha_inicio.substring(0, 4)) : new Date().getFullYear();
    const yearTo = fecha_fin ? parseInt(fecha_fin.substring(0, 4)) : new Date().getFullYear();

    const budgetSql = `
      SELECT
        be.equipment_id,
        ba.year,
        bmd.month,
        bmd.amount,
        COALESCE(bmd.working_days, 22) AS working_days
      FROM budget_monthly_detail bmd
      JOIN budget_equipment be ON be.id = bmd.budget_equipment_id
      JOIN budget_annual ba ON ba.id = be.budget_annual_id
      WHERE ba.year >= $1 AND ba.year <= $2
        AND bmd.working_days > 0
    `;
    const budgetRes = await query(budgetSql, [yearFrom, yearTo]);

    // Map: equipo_id -> 'YYYY-MM' -> { amount, working_days }
    const budgetMap = new Map();
    for (const row of budgetRes.rows) {
      const key = row.equipment_id;
      if (!budgetMap.has(key)) budgetMap.set(key, new Map());
      const mStr = String(row.month).padStart(2, '0');
      budgetMap.get(key).set(`${row.year}-${mStr}`, {
        amount: parseFloat(row.amount || 0),
        workingDays: parseInt(row.working_days) || 22
      });
    }

    // 3. Calcular días hábiles en taller por OT, prorrateando por mes
    const detalle = [];
    const equipoStats = new Map();  // equipo -> total_perdido
    const tipoStats = new Map();    // tipo -> total_perdido
    const mesStats = new Map();     // mes -> total_perdido

    for (const ot of ots) {
      const apertura = new Date(ot.fecha_apertura);
      const cierre = ot.fecha_cierre ? new Date(ot.fecha_cierre) : new Date();
      const diasCalendario = Math.max(Math.ceil((cierre - apertura) / (1000 * 60 * 60 * 24)), 1);

      // Distribuir días por mes (sin off-by-one)
      const mesesTaller = new Map(); // 'YYYY-MM' -> dias en ese mes
      let fechaActual = new Date(apertura.getFullYear(), apertura.getMonth(), apertura.getDate());
      const fechaFin = new Date(cierre.getFullYear(), cierre.getMonth(), cierre.getDate());

      while (fechaActual <= fechaFin) {
        const mesKey = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}`;
        const ultimoDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
        const diaActual = fechaActual.getDate();
        const diasRestantesEnMes = ultimoDiaMes - diaActual + 1;
        const diasRestantesTotal = Math.ceil((fechaFin - fechaActual) / 86400000) + 1;
        const diffDias = Math.min(diasRestantesEnMes, diasRestantesTotal);
        mesesTaller.set(mesKey, (mesesTaller.get(mesKey) || 0) + diffDias);
        fechaActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1);
      }

      // Calcular valor perdido por mes
      let totalPerdidoOT = 0;
      let totalDiasHabiles = 0;
      const eqBudget = budgetMap.get(ot.equipo_id) || new Map();

      for (const [mes, diasCal] of mesesTaller) {
        const budget = eqBudget.get(mes);
        if (budget && budget.workingDays > 0 && budget.amount > 0) {
          const valorDia = budget.amount / budget.workingDays;
          const diasHabilesMes = Math.min(diasCal, budget.workingDays);
          const perdida = valorDia * diasHabilesMes;
          totalPerdidoOT += perdida;
          totalDiasHabiles += diasHabilesMes;

          // Acumular por mes
          mesStats.set(mes, (mesStats.get(mes) || 0) + perdida);
        }
      }

      if (totalPerdidoOT > 0) {
        const eqKey = `${ot.marca || ''} ${ot.modelo || ''} (${ot.serial || ''})`.trim();
        equipoStats.set(eqKey, (equipoStats.get(eqKey) || 0) + totalPerdidoOT);
        tipoStats.set(ot.tipo_mantenimiento, (tipoStats.get(ot.tipo_mantenimiento) || 0) + totalPerdidoOT);

        detalle.push({
          ot_id: ot.id,
          consecutivo: ot.consecutivo,
          tipo_mantenimiento: ot.tipo_mantenimiento,
          equipo: eqKey,
          empresa: ot.empresa_nombre || 'Sin empresa',
          fecha_apertura: ot.fecha_apertura,
          fecha_cierre: ot.fecha_cierre,
          dias_calendario: diasCalendario,
          dias_habiles: totalDiasHabiles,
          valor_perdido: parseFloat(totalPerdidoOT.toFixed(0)),
          estado: ot.estado
        });
      }
    }

    // 4. Construir respuesta
    const totalPerdido = detalle.reduce((sum, d) => sum + d.valor_perdido, 0);
    const porEquipo = Array.from(equipoStats.entries())
      .map(([equipo, total]) => ({ equipo, total: parseFloat(total.toFixed(0)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
    const porTipo = Array.from(tipoStats.entries())
      .map(([tipo, total]) => ({ tipo, total: parseFloat(total.toFixed(0)) }));
    const porMes = Array.from(mesStats.entries())
      .map(([mes, total]) => ({ mes, total: parseFloat(total.toFixed(0)) }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
      fecha_inicio, fecha_fin,
      equipo_id: equipo_id || null, empresa_id: empresa_id || null,
      tipo_mantenimiento: tipo_mantenimiento || null,
      total_perdido: parseFloat(totalPerdido.toFixed(0)),
      total_ots: ots.length,
      total_ots_con_presupuesto: detalle.length,
      detalle,
      por_equipo: porEquipo,
      por_tipo: porTipo,
      por_mes: porMes
    };
  }

  // ════════════════════════════════════════════════════════════
  // EMAIL MARKETING REPORTS / BI
  // ════════════════════════════════════════════════════════════

  async getEmailDashboardResumen(fecha_inicio, fecha_fin) {
    const params = [];
    const conditions = [];
    let i = 1;
    if (fecha_inicio) {
      conditions.push(`created_at >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`created_at <= $${i++}`);
      params.push(fecha_fin);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        COALESCE(SUM(total_envios), 0) AS total_enviados,
        COALESCE(SUM(enviados), 0) AS total_entregados,
        COALESCE(SUM(fallidos), 0) AS total_fallidos,
        COALESCE(SUM(abiertos), 0) AS total_abiertos,
        COALESCE(SUM(clicks), 0) AS total_clicks,
        COUNT(*) AS total_campanas
      FROM email_campanas
      ${where}
    `;

    const result = await query(sql, params);
    return result.rows[0];
  }

  async getEmailTasasPorCampana(fecha_inicio, fecha_fin) {
    const params = [];
    const conditions = ['deleted_at IS NULL', "estado = 'completada'"];
    let i = 1;
    if (fecha_inicio) {
      conditions.push(`created_at >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`created_at <= $${i++}`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT
        id,
        nombre,
        total_envios,
        enviados,
        abiertos,
        clicks,
        CASE WHEN enviados > 0 THEN ROUND((abiertos::numeric / enviados::numeric) * 100, 2) ELSE 0 END AS tasa_apertura,
        CASE WHEN abiertos > 0 THEN ROUND((clicks::numeric / abiertos::numeric) * 100, 2) ELSE 0 END AS tasa_clics
      FROM email_campanas
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async getEmailEvolucionListas(fecha_inicio, fecha_fin) {
    const params = [];
    const conditions = [];
    let i = 1;
    if (fecha_inicio) {
      conditions.push(`created_at >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`created_at <= $${i++}`);
      params.push(fecha_fin);
    }

    const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes,
        COUNT(*) FILTER (WHERE estado = 'activo') AS altas,
        COUNT(*) FILTER (WHERE estado = 'baja') AS bajas
      FROM email_contactos
      WHERE deleted_at IS NULL ${where}
      GROUP BY date_trunc('month', created_at)
      ORDER BY mes ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async getEmailRankingPlantillas() {
    const sql = `
      SELECT
        p.id,
        p.nombre,
        COUNT(c.id) AS veces_usada,
        COALESCE(SUM(c.enviados), 0) AS total_enviados,
        COALESCE(SUM(c.abiertos), 0) AS total_abiertos,
        COALESCE(SUM(c.clicks), 0) AS total_clicks,
        CASE WHEN SUM(c.enviados) > 0 THEN ROUND((SUM(c.abiertos)::numeric / SUM(c.enviados)::numeric) * 100, 2) ELSE 0 END AS tasa_apertura_promedio
      FROM email_plantillas p
      LEFT JOIN email_campanas c ON c.plantilla_id = p.id AND c.estado = 'completada'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY tasa_apertura_promedio DESC
      LIMIT 10
    `;
    const result = await query(sql);
    return result.rows;
  }

  async getEmailSaludLista() {
    const sql = `
      SELECT
        estado,
        COUNT(*) AS cantidad,
        ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM email_contactos WHERE deleted_at IS NULL)::numeric) * 100, 2) AS porcentaje
      FROM email_contactos
      WHERE deleted_at IS NULL
      GROUP BY estado
    `;
    const result = await query(sql);
    return result.rows;
  }

  async getEmailComparativoCampanas(limit = 6) {
    const sql = `
      SELECT
        nombre,
        enviados,
        abiertos,
        clicks,
        fallidos
      FROM email_campanas
      WHERE deleted_at IS NULL AND estado = 'completada'
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const result = await query(sql, [limit]);
    return result.rows;
  }

  async getEmailEvolucionMensual(fecha_inicio, fecha_fin) {
    const params = [];
    const conditions = ['deleted_at IS NULL', "estado = 'completada'"];
    let i = 1;
    if (fecha_inicio) {
      conditions.push(`created_at >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`created_at <= $${i++}`);
      params.push(fecha_fin);
    }

    const sql = `
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes,
        COALESCE(SUM(enviados), 0) AS enviados,
        COALESCE(SUM(abiertos), 0) AS abiertos,
        COALESCE(SUM(clicks), 0) AS clicks
      FROM email_campanas
      WHERE ${conditions.join(' AND ')}
      GROUP BY date_trunc('month', created_at)
      ORDER BY mes ASC
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  async getRemisionesLiquidadas(fecha_inicio, fecha_fin, empresa_id) {
    const conditions = [
      "r.deleted_at IS NULL", 
      "r.estado = 'LIQUIDADA'", 
      "r.factura_id IS NULL"
    ];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`r.updated_at >= $${i++}`);
      params.push(`${fecha_inicio} 00:00:00`);
    }
    if (fecha_fin) {
      conditions.push(`r.updated_at <= $${i++}`);
      params.push(`${fecha_fin} 23:59:59`);
    }
    if (empresa_id) {
      conditions.push(`r.company_id = $${i++}`);
      params.push(empresa_id);
    }

    const sql = `
      SELECT 
        r.id,
        r.numero_remision,
        r.fecha_servicio,
        r.updated_at AS fecha_liquidacion,
        EXTRACT(DAY FROM NOW() - r.updated_at)::int AS dias_desde_liquidacion,
        c.name AS empresa_nombre,
        c.nit AS empresa_nit,
        e.serie AS equipo_numero,
        e.marca AS equipo_marca,
        r.total_bruto,
        r.iva_valor,
        r.total_neto,
        r.estado
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.updated_at ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }
}

// Utility: format decimal hours to "Xh Ym"
function formatHours(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const informesRepository = new InformesRepository();

// ── Helper para cálculo de Horas Extras ──
// Lunes (1) a Jueves (4): 07:00 a 16:15
// Viernes (5): 07:00 a 16:10
// Sábado (6): 07:00 a 10:50
// Domingo (0) o Festivo: Todo es extra
function calcularHorasExtras(horaSalida, horaLlegada, diaSemana, esFestivo) {
  if (!horaSalida || !horaLlegada) return 0;
  
  // Convertimos 'HH:MM:SS' a minutos desde la medianoche
  const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };
  
  const inicioTrabajo = toMinutes(horaSalida);
  let finTrabajo = toMinutes(horaLlegada);
  
  // Si terminó al día siguiente (ej. de 23:00 a 02:00)
  if (finTrabajo < inicioTrabajo) {
    finTrabajo += 24 * 60;
  }
  
  const totalMinutosTrabajados = finTrabajo - inicioTrabajo;
  if (totalMinutosTrabajados <= 0) return 0;

  // Si es Domingo (0) o Festivo, TODO es extra
  if (diaSemana === 0 || esFestivo) {
    return totalMinutosTrabajados / 60;
  }

  // Definir horario normal en minutos según el día
  let inicioNormal = toMinutes('07:00');
  let finNormal = 0;

  if (diaSemana >= 1 && diaSemana <= 4) {
    // Lunes a Jueves
    finNormal = toMinutes('16:15');
  } else if (diaSemana === 5) {
    // Viernes
    finNormal = toMinutes('16:10');
  } else if (diaSemana === 6) {
    // Sábado
    finNormal = toMinutes('10:50');
  }

  // Calcular minutos trabajados DENTRO del horario normal
  const trabajoNormalInicio = Math.max(inicioTrabajo, inicioNormal);
  const trabajoNormalFin = Math.min(finTrabajo, finNormal);
  
  let minutosNormales = 0;
  if (trabajoNormalFin > trabajoNormalInicio) {
    minutosNormales = trabajoNormalFin - trabajoNormalInicio;
  }
  
  // El resto son horas extras
  const minutosExtras = totalMinutosTrabajados - minutosNormales;
  
  return minutosExtras > 0 ? minutosExtras / 60 : 0;
}

