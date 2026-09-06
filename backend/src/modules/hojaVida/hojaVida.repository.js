import { query } from '../../config/database.js';

/**
 * Hoja de Vida de Equipo — Repositorio
 *
 * Endpoint de solo lectura que consolida en una sola vista todo el historial
 * relevante de un equipo: remisiones, tramos de sustitución, OTs/mantenimiento,
 * resumen agregado y estado de facturación.
 *
 * ORACLE DE DATOS: todas las queries son SELECTs sobre tablas existentes
 * (equipos, equipos_completo, remisiones, remision_tramos_equipo, ordenes_trabajo,
 * ot_liquidacion, factura_remisiones, facturas, equipos_historial_estado).
 * No se modifican ni se crean tablas. No se agregan columnas ni constraints.
 */

export class HojaVidaRepository {

  /**
   * Resumen agregado del equipo.
   * Devuelve: horas_totales, numero_servicios, numero_mantenimientos,
   * costo_mantenimiento_total, resumen_facturacion (total_neto, total_facturado,
   * saldo_pendiente, numero_facturas), kpi_soat.
   */
  async getResumen(equipoId) {
    // ─── Horas totales ─────────────────────────────────────────────────────
    // Alquilado: sumatoria de cantidad_horas de remisiones en estado activo
    const alquiladoSql = `
      SELECT COALESCE(SUM(cantidad_horas), 0) AS horas_alquilado
      FROM remisiones
      WHERE equipo_id = $1
        AND deleted_at IS NULL
        AND estado IN ('REALIZADA', 'LIQUIDADA', 'FACTURADA')
        AND cantidad_horas IS NOT NULL
        AND cantidad_horas > 0
    `;

    // Tiempo en taller (OTs): sumatoria de (salida - ingreso)
    const tallerSql = `
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (fecha_hora_salida_taller - fecha_hora_ingreso_taller)) / 3600), 0) AS horas_taller
      FROM ordenes_trabajo
      WHERE equipo_id = $1
        AND deleted_at IS NULL
        AND fecha_hora_ingreso_taller IS NOT NULL
        AND fecha_hora_salida_taller IS NOT NULL
    `;

    // ─── Contadores ─────────────────────────────────────────────────────────
    const serviciosSql = `
      SELECT COUNT(*)::int AS total
      FROM remisiones
      WHERE equipo_id = $1
        AND deleted_at IS NULL
        AND estado <> 'ANULADO'
    `;

    const mantenimientosSql = `
      SELECT COUNT(*)::int AS total
      FROM ordenes_trabajo
      WHERE equipo_id = $1
        AND deleted_at IS NULL
    `;

    // ─── Costo total de mantenimiento ───────────────────────────────────────
    const costoMantenimientoSql = `
      SELECT COALESCE(SUM(otl.total_final), 0) AS costo_total
      FROM ordenes_trabajo ot
      JOIN ot_liquidacion otl ON otl.orden_trabajo_id = ot.id
      WHERE ot.equipo_id = $1
        AND ot.deleted_at IS NULL
    `;

    // ─── Resumen de facturación de remisiones del equipo ────────────────────
    // total_neto: suma de total_neto de todas las remisiones (no anuladas)
    // total_facturado: suma de factura_remisiones.total_rem para esas remisiones
    // saldo_pendiente: total_neto - total_facturado
    // numero_facturas: count distinto de facturas
    const facturacionSql = `
      SELECT
        COALESCE(SUM(r.total_neto), 0) AS total_neto,
        COALESCE(SUM(fr.total_rem), 0)  AS total_facturado,
        COUNT(DISTINCT fr.factura_id)    AS numero_facturas
      FROM remisiones r
      LEFT JOIN factura_remisiones fr ON fr.remision_id = r.id
      WHERE r.equipo_id = $1
        AND r.deleted_at IS NULL
        AND r.estado <> 'ANULADO'
    `;

    const [a, t, s, m, c, f] = await Promise.all([
      query(alquiladoSql, [equipoId]),
      query(tallerSql, [equipoId]),
      query(serviciosSql, [equipoId]),
      query(mantenimientosSql, [equipoId]),
      query(costoMantenimientoSql, [equipoId]),
      query(facturacionSql, [equipoId]),
    ]);

    const horas_alquilado = parseFloat(a.rows[0]?.horas_alquilado || 0);
    const horas_taller    = parseFloat(t.rows[0]?.horas_taller    || 0);
    const total_neto       = parseFloat(f.rows[0]?.total_neto       || 0);
    const total_facturado  = parseFloat(f.rows[0]?.total_facturado  || 0);

    return {
      horas_totales: {
        alquilado: horas_alquilado,
        taller:    horas_taller,
        total:     parseFloat((horas_alquilado + horas_taller).toFixed(2)),
      },
      numero_servicios:        s.rows[0]?.total        || 0,
      numero_mantenimientos:   m.rows[0]?.total        || 0,
      costo_mantenimiento_total: parseFloat(c.rows[0]?.costo_total || 0),
      resumen_facturacion: {
        total_neto:        total_neto,
        total_facturado:   total_facturado,
        saldo_pendiente:   parseFloat((total_neto - total_facturado).toFixed(2)),
        numero_facturas:   f.rows[0]?.numero_facturas || 0,
      },
    };
  }

  /**
   * Historial cronológico unificado paginado.
   *
   * Cada fila es uno de:
   *  - { tipo: 'remision' | 'tramo' | 'ot' | 'estado' }
   *
   * Orden: created_at DESC, id DESC (tiebreaker).
   * Cursor-based pagination: se pasa el created_at + id de la última fila vista.
   */
  async getHistorial(equipoId, { fecha_desde, fecha_hasta, limit = 50, cursor } = {}) {
    // Build date-filter fragments shared by all queries
    const dateFrom = fecha_desde ? ` AND created_at >= $2` : '';
    const dateTo   = fecha_hasta ? ` AND created_at <= ($${fecha_desde ? 3 : 2}::date + INTERVAL '1 day')` : '';
    const dateParams = [];
    if (fecha_desde) dateParams.push(fecha_desde);
    if (fecha_hasta) dateParams.push(fecha_hasta);

    // 4 independent queries (no UNION — each CTE has different column shapes)
    const [remisionesRes, tramosRes, otsRes, estadoRes] = await Promise.all([
      query(
        `SELECT
           'remision' AS tipo, r.created_at, r.id AS uid,
           r.id AS remision_id, r.numero_remision, r.fecha_servicio,
           r.estado AS remision_estado, c.name AS empresa_nombre,
           COALESCE(
             (SELECT string_agg(DISTINCT em.full_name, ', ')
              FROM remision_operarios ro JOIN employees em ON em.id = ro.empleado_id
              WHERE ro.remision_id = r.id), '—') AS operarios,
           COALESCE(
             (SELECT string_agg(COALESCE(inv.nombre_comercial, cs.nombre), ' / ')
              FROM remision_servicios rs
              LEFT JOIN inventario inv ON inv.id = rs.catalogo_servicio_id
              LEFT JOIN catalogo_servicios cs ON cs.id = rs.catalogo_servicio_id
              WHERE rs.remision_id = r.id), '—') AS servicio_nombres,
           r.cantidad_horas, r.horometro_salida, r.horometro_regreso, r.total_neto,
           (SELECT json_agg(json_build_object(
              'numero_factura', f.numero_factura, 'estado', f.estado, 'fecha_factura', f.fecha_factura
            ) ORDER BY f.created_at)
            FROM factura_remisiones fr JOIN facturas f ON f.id = fr.factura_id
            WHERE fr.remision_id = r.id) AS facturacion
         FROM remisiones r
         JOIN companies c ON c.id = r.company_id
         WHERE r.equipo_id = $1 AND r.deleted_at IS NULL AND r.estado <> 'ANULADO'
           ${dateFrom}${dateTo}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT $${2 + dateParams.length}`,
        [equipoId, ...dateParams, limit + 1]
      ),
      query(
        `SELECT
           'tramo' AS tipo, t.created_at, t.id AS uid,
           t.id AS tramo_id, t.remision_id, r.numero_remision,
           t.fecha_inicio, t.fecha_fin, t.motivo,
           r.estado AS remision_estado, c.name AS empresa_nombre,
           t.fecha_fin IS NULL AS vigente
         FROM remision_tramos_equipo t
         JOIN remisiones r ON r.id = t.remision_id
         JOIN companies c ON c.id = r.company_id
         WHERE t.equipo_id = $1
           ${dateFrom}${dateTo}
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT $${2 + dateParams.length}`,
        [equipoId, ...dateParams, limit + 1]
      ),
      query(
        `SELECT
           'ot' AS tipo, ot.created_at, ot.id AS uid,
           ot.id AS ot_id, ot.consecutivo, ot.created_at AS fecha,
           ot.tipo_mantenimiento, ot.estado AS ot_estado, ot.detalle_servicio,
           ot.horometro_inicial, ot.horometro_final, c.name AS empresa_nombre,
           COALESCE(
             (SELECT string_agg(DISTINCT em.full_name, ', ')
              FROM ot_tecnicos t JOIN employees em ON em.id = t.empleado_id
              WHERE t.orden_trabajo_id = ot.id), '—') AS tecnicos,
           (SELECT total_final FROM ot_liquidacion WHERE orden_trabajo_id = ot.id) AS costo_total,
           (SELECT numero_factura FROM facturas WHERE id = ot.factura_id) AS numero_factura
         FROM ordenes_trabajo ot
         JOIN companies c ON c.id = ot.empresa_id
         WHERE ot.equipo_id = $1 AND ot.deleted_at IS NULL
           ${dateFrom}${dateTo}
         ORDER BY ot.created_at DESC, ot.id DESC
         LIMIT $${2 + dateParams.length}`,
        [equipoId, ...dateParams, limit + 1]
      ),
      query(
        `SELECT
           'estado' AS tipo, eh.created_at, eh.id AS uid,
           NULL::uuid AS remision_id, NULL::text AS numero_remision,
           eh.created_at AS fecha,
           eh.estado_anterior, eh.estado_nuevo, eh.motivo, eh.cambiado_por
         FROM equipos_historial_estado eh
         WHERE eh.equipo_id = $1
           ${dateFrom}${dateTo}
         ORDER BY eh.created_at DESC, eh.id DESC
         LIMIT $${2 + dateParams.length}`,
        [equipoId, ...dateParams, limit + 1]
      ),
    ]);

    // Merge all rows
    let allRows = [
      ...remisionesRes.rows,
      ...tramosRes.rows,
      ...otsRes.rows,
      ...estadoRes.rows,
    ];

    // Apply cursor filter in JS (cursor = `created_at|id`)
    if (cursor) {
      const [cursorCreatedAt, cursorId] = cursor.split('|');
      allRows = allRows.filter(r => {
        const rTs = new Date(r.created_at).getTime();
        const cTs = new Date(cursorCreatedAt).getTime();
        return rTs < cTs || (rTs === cTs && String(r.uid) < String(cursorId));
      });
    }

    // Sort DESC by created_at, then uid
    allRows.sort((a, b) => {
      const dA = new Date(a.created_at).getTime();
      const dB = new Date(b.created_at).getTime();
      if (dB !== dA) return dB - dA;
      return String(b.uid).localeCompare(String(a.uid));
    });

    const hasMore = allRows.length > limit;
    const rows = hasMore ? allRows.slice(0, limit) : allRows;
    const historial = rows.map(this._mapRow);

    return {
      data: historial,
      pagination: {
        hasMore,
        nextCursor: hasMore ? `${rows[rows.length - 1].created_at}|${rows[rows.length - 1].uid}` : null,
      },
    };
  }

  /**
   * Mapea una fila del UNION a la shape de respuesta unificada.
   */
  _mapRow(row) {
    if (row.tipo === 'remision') {
      const facturacion = row.facturacion || [];
      return {
        tipo: 'remision',
        id: row.remision_id,
        numero: row.numero_remision,
        fecha_servicio: row.fecha_servicio,
        estado: row.remision_estado,
        empresa_cliente: row.empresa_nombre,
        operarios: row.operarios,
        servicios: row.servicio_nombres,
        cantidad_horas: row.cantidad_horas,
        horometro_salida: row.horometro_salida,
        horometro_regreso: row.horometro_regreso,
        total_neto: row.total_neto,
        facturacion: facturacion.map(f => ({
          numero_factura: f.numero_factura,
          estado: f.estado,
          fecha_factura: f.fecha_factura,
        })),
      };
    }

    if (row.tipo === 'tramo') {
      return {
        tipo: 'tramo',
        id: row.tramo_id,
        remision_numero: row.numero_remision,
        remision_id: row.remision_id,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        vigente: row.vigente,
        motivo: row.motivo,
        empresa_cliente: row.empresa_nombre,
        estado_remision: row.remision_estado,
      };
    }

    if (row.tipo === 'ot') {
      return {
        tipo: 'ot',
        id: row.ot_id,
        consecutivo: row.consecutivo,
        fecha: row.fecha,
        tipo_mantenimiento: row.tipo_mantenimiento,
        estado: row.ot_estado,
        detalle_servicio: row.detalle_servicio,
        horometro_inicial: row.horometro_inicial,
        horometro_final: row.horometro_final,
        empresa: row.empresa_nombre,
        tecnicos: row.tecnicos,
        costo_total: row.costo_total,
        numero_factura: row.numero_factura,
      };
    }

    // estado
    return {
      tipo: 'estado',
      id: row.uid,
      fecha: row.fecha,
      estado_anterior: row.estado_anterior,
      estado_nuevo: row.estado_nuevo,
      motivo: row.motivo,
      cambiado_por: row.cambiado_por,
    };
  }
}
