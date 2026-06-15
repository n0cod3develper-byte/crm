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
}

// Utility: format decimal hours to "Xh Ym"
function formatHours(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const informesRepository = new InformesRepository();
