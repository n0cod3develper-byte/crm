import { query } from '../../config/database.js';

export class ReportsRepository {
  async findServiciosSales(fecha_desde, fecha_hasta) {
    const conditions = ['r.deleted_at IS NULL', "r.estado != 'ANULADO'"];
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
      SELECT r.id,
             r.numero_remision,
             r.fecha_servicio,
             r.total_bruto,
             r.iva_valor,
             r.descuentos,
             r.estado,
             c.name AS empresa_nombre,
             e.marca AS equipo_marca,
             e.modelo AS equipo_modelo,
             e.serial AS equipo_serial,
             cs.nombre AS servicio_nombre,
             cs.tipo_servicio
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      JOIN equipos e ON e.id = r.equipo_id
      JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.fecha_servicio DESC, r.created_at DESC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  async findMantenimientoSales(fecha_desde, fecha_hasta) {
    const conditions = ['ot.deleted_at IS NULL', 'l.id IS NOT NULL'];
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
             l.fecha_liquidacion,
             l.total_mano_obra,
             l.total_repuestos,
             l.subtotal,
             l.impuesto_valor,
             l.total_final
      FROM ordenes_trabajo ot
      JOIN companies c ON c.id = ot.empresa_id
      JOIN equipos e ON e.id = ot.equipo_id
      JOIN ot_liquidacion l ON l.orden_trabajo_id = ot.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.fecha_liquidacion DESC, ot.created_at DESC
    `;

    const result = await query(sql, params);
    return result.rows;
  }
}
