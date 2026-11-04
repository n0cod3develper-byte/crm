import { query } from '../../config/database.js';

export class ReportsRepository {
  async findServiciosSales(fecha_desde, fecha_hasta) {
    const conditions = ['(r.deleted_at IS NULL OR r.estado IN (\'ANULADO\', \'ANULADA\'))'];
    const params = [];
    let i = 1;

    if (fecha_desde) {
      conditions.push(`r.fecha_servicio >= $${i++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`r.fecha_servicio <= $${i++}`);
      params.push(fecha_hasta);
    }

    const sql = `
      WITH remision_totales AS (
        SELECT remision_id, SUM(subtotal) AS total_items_subtotal, COUNT(*) AS count_items
        FROM remision_servicios
        GROUP BY remision_id
      )
      SELECT r.id,
             rs.id AS item_id,
             r.numero_remision,
             r.fecha_servicio,
             r.estado,
             r.motivo_anulacion,
             r.total_bruto,
             r.iva_valor,
             CASE 
               WHEN r.estado IN ('ANULADO', 'ANULADA') THEN 0
               WHEN rt.total_items_subtotal > 0 THEN 
                 ROUND((r.total_neto * (rs.subtotal / rt.total_items_subtotal))::numeric, 2)
               ELSE 
                 ROUND((r.total_neto / rt.count_items)::numeric, 2)
             END AS total_neto,
             CASE 
               WHEN r.descuentos > 0 AND rt.total_items_subtotal > 0 THEN 
                 ROUND((r.descuentos * (rs.subtotal / rt.total_items_subtotal))::numeric, 2)
               ELSE 0
             END AS descuentos,
             rs.cantidad AS cantidad_horas,
             rs.valor_unitario,
             rs.subtotal AS item_subtotal,
             r.horometro_salida,
             r.horometro_regreso,
             c.name AS empresa_nombre,
             e.marca AS equipo_marca,
             e.modelo AS equipo_modelo,
             e.serial AS equipo_serial,
             e.serie AS equipo_serie,
             e.capacidad_nominal,
             cs.codigo AS servicio_codigo,
             COALESCE(NULLIF(TRIM(rs.descripcion), ''), cs.nombre) AS servicio_nombre,
             cs.nombre AS catalogo_nombre,
             COALESCE(cs.tipo_servicio, cs.tipo, '—') AS tipo_servicio,
             (
               SELECT string_agg(DISTINCT em.full_name, ', ')
               FROM remision_operarios ro
               JOIN employees em ON em.id = ro.empleado_id
               WHERE ro.remision_id = r.id
             ) AS operario_nombre,
             (
               SELECT string_agg(DISTINCT f2.numero_factura, ', ')
               FROM factura_remisiones fr2
               JOIN facturas f2 ON f2.id = fr2.factura_id
               WHERE fr2.remision_id = r.id
               AND f2.numero_factura IS NOT NULL
             ) AS numero_factura
      FROM remisiones r
      JOIN remision_servicios rs ON rs.remision_id = r.id
      JOIN remision_totales rt ON rt.remision_id = r.id
      JOIN companies c ON c.id = r.company_id
      LEFT JOIN catalogo_servicios cs ON cs.id = rs.catalogo_servicio_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.numero_remision DESC, rs.orden ASC, rs.created_at ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene remisiones en el rango de fechas con valor neto ajustado.
   * Aplica 0 al neto cuando la remisión está ANULADA y elimina duplicados.
   */
  async getRemisionesPeriodo(fechaDesde, fechaHasta) {
    const conditions = ['(r.deleted_at IS NULL OR r.estado = \'ANULADO\')'];
    const params = [];
    let i = 1;
    if (fechaDesde) {
      conditions.push(`r.fecha_servicio >= $${i++}`);
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      conditions.push(`r.fecha_servicio <= $${i++}`);
      params.push(fechaHasta);
    }
    const sql = `
      SELECT DISTINCT ON (r.id)
             r.id,
             r.numero_remision,
             r.fecha_servicio,
             r.estado,
             r.motivo_anulacion,
             CASE WHEN r.estado = 'ANULADO' THEN 0 ELSE r.total_neto END AS neto
      FROM remisiones r
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.id, r.fecha_servicio DESC
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  async findMantenimientoSales(fecha_desde, fecha_hasta) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (fecha_desde) {
      conditions.push(`l.fecha_liquidacion >= $${i++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`l.fecha_liquidacion <= $${i++}::date + interval '1 day'`);
      params.push(fecha_hasta);
    }

    const sql = `
      SELECT ot.id,
             ot.consecutivo,
             ot.created_at,
             ot.tipo_mantenimiento,
             ot.estado,
             c.name AS empresa_nombre,
             e.marca AS equipo_marca,
             e.modelo AS equipo_modelo,
             e.serial AS equipo_serial,
             e.serie AS equipo_serie,
             l.fecha_liquidacion,
             l.total_mano_obra,
             l.total_repuestos,
             l.subtotal,
             l.impuesto_valor,
             l.total_final,
             f.numero_factura
      FROM ordenes_trabajo ot
      JOIN companies c ON c.id = ot.empresa_id
      JOIN equipos e ON e.id = ot.equipo_id
      JOIN ot_liquidacion l ON l.orden_trabajo_id = ot.id
      LEFT JOIN facturas f ON f.id = ot.factura_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.fecha_liquidacion DESC, ot.created_at DESC
    `;

    const result = await query(sql, params);
    return result.rows;
  }
}
