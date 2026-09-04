import { query } from '../../config/database.js';

export class ReportsRepository {
  async findServiciosSales(fecha_desde, fecha_hasta) {
    const conditions = ['r.deleted_at IS NULL'];
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
      SELECT rs.id AS item_id,
             rs.cantidad AS item_cantidad,
             rs.valor_unitario AS item_valor_unitario,
             rs.subtotal AS item_subtotal,
             rs.aplica_iva AS item_aplica_iva,
             rs.descripcion AS item_descripcion,
             COALESCE(inv.nombre_comercial, cs_item.nombre) AS item_nombre,
             COALESCE(inv.codigo_interno, cs_item.codigo) AS item_codigo,
             r.id AS remision_id,
             r.numero_remision,
             r.fecha_servicio,
             r.iva_pct,
             r.descuentos,
             r.cantidad_horas,
             r.estado,
             c.name AS empresa_nombre,
             e.serie AS equipo_serie,
             COALESCE(inv.tipo, cs_item.tipo_servicio) AS item_tipo_servicio,
             (
               SELECT string_agg(DISTINCT f2.numero_factura, ', ')
               FROM factura_remisiones fr2
               JOIN facturas f2 ON f2.id = fr2.factura_id
               WHERE fr2.remision_id = r.id
               AND f2.numero_factura IS NOT NULL
             ) AS numero_factura
      FROM remision_servicios rs
      JOIN remisiones r ON r.id = rs.remision_id
      JOIN companies c ON c.id = r.company_id
      LEFT JOIN equipos e ON e.id = r.equipo_id
      LEFT JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      LEFT JOIN inventario inv ON inv.id = rs.catalogo_servicio_id
      LEFT JOIN catalogo_servicios cs_item ON cs_item.id = rs.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.created_at DESC, rs.orden ASC
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
