import { query, withTransaction } from '../../config/database.js';

export class HistorialRepository {

  // ─── Listar historial de un equipo ───────────────────────────
  async findAll(equipoId, { tipo_mantenimiento, fecha_desde, fecha_hasta, estado_equipo_al_cierre } = {}) {
    const conditions = ['h.equipo_id = $1'];
    const params = [equipoId];
    let i = 2;

    if (tipo_mantenimiento && tipo_mantenimiento !== 'all') {
      conditions.push(`h.tipo_mantenimiento = $${i++}`);
      params.push(tipo_mantenimiento);
    }
    if (fecha_desde) {
      conditions.push(`h.fecha_hora_ingreso_taller >= $${i++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`h.fecha_hora_ingreso_taller <= $${i++}`);
      params.push(fecha_hasta);
    }
    if (estado_equipo_al_cierre && estado_equipo_al_cierre !== 'all') {
      conditions.push(`h.estado_equipo_al_cierre = $${i++}`);
      params.push(estado_equipo_al_cierre);
    }

    const sql = `
      SELECT
        h.*,
        ot.consecutivo                          AS ot_consecutivo,
        sup.full_name                           AS supervisor_nombre,
        -- Tiempos calculados en minutos
        CASE
          WHEN h.fecha_hora_salida_taller IS NOT NULL AND h.fecha_hora_ingreso_taller IS NOT NULL
          THEN EXTRACT(EPOCH FROM (h.fecha_hora_salida_taller - h.fecha_hora_ingreso_taller)) / 60
          ELSE NULL
        END                                     AS tiempo_en_taller_min,
        CASE
          WHEN h.fecha_fin_bodega IS NOT NULL AND h.fecha_inicio_bodega IS NOT NULL
          THEN EXTRACT(EPOCH FROM (h.fecha_fin_bodega - h.fecha_inicio_bodega)) / 60
          ELSE NULL
        END                                     AS tiempo_en_bodega_min,
        -- Técnicos (aggregated)
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', em.id,
            'full_name', em.full_name,
            'position', em.position
          ))
          FROM historial_tecnicos ht
          JOIN employees em ON em.id = ht.empleado_id
          WHERE ht.historial_id = h.id),
          '[]'::json
        )                                       AS tecnicos
      FROM historial_equipo h
      LEFT JOIN ordenes_trabajo ot ON ot.id = h.orden_trabajo_id
      LEFT JOIN users sup          ON sup.id = h.supervisor_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY h.fecha_hora_ingreso_taller DESC NULLS LAST, h.created_at DESC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Detalle completo de un registro ─────────────────────────
  async findById(equipoId, historialId) {
    const hRes = await query(`
      SELECT
        h.*,
        ot.consecutivo                          AS ot_consecutivo,
        sup.full_name                           AS supervisor_nombre,
        cb.full_name                            AS creado_por_nombre,
        CASE
          WHEN h.fecha_hora_salida_taller IS NOT NULL AND h.fecha_hora_ingreso_taller IS NOT NULL
          THEN EXTRACT(EPOCH FROM (h.fecha_hora_salida_taller - h.fecha_hora_ingreso_taller)) / 60
          ELSE NULL
        END AS tiempo_en_taller_min,
        CASE
          WHEN h.fecha_fin_bodega IS NOT NULL AND h.fecha_inicio_bodega IS NOT NULL
          THEN EXTRACT(EPOCH FROM (h.fecha_fin_bodega - h.fecha_inicio_bodega)) / 60
          ELSE NULL
        END AS tiempo_en_bodega_min
      FROM historial_equipo h
      LEFT JOIN ordenes_trabajo ot ON ot.id = h.orden_trabajo_id
      LEFT JOIN users sup          ON sup.id = h.supervisor_id
      LEFT JOIN users cb           ON cb.id = h.created_by
      WHERE h.id = $1 AND h.equipo_id = $2
    `, [historialId, equipoId]);

    if (!hRes.rows[0]) return null;
    const h = hRes.rows[0];

    // Técnicos
    const tecRes = await query(`
      SELECT ht.id AS asignacion_id, em.id AS empleado_id,
             em.full_name, em.position, em.phone
      FROM historial_tecnicos ht
      JOIN employees em ON em.id = ht.empleado_id
      WHERE ht.historial_id = $1
      ORDER BY em.full_name
    `, [historialId]);
    h.tecnicos = tecRes.rows;

    // Repuestos
    const repRes = await query(`
      SELECT * FROM historial_repuestos
      WHERE historial_id = $1
      ORDER BY created_at ASC
    `, [historialId]);
    h.repuestos = repRes.rows;

    return h;
  }

  // ─── Crear nuevo registro de historial ───────────────────────
  async create(equipoId, data, userId) {
    return await withTransaction(async (client) => {
      const {
        orden_trabajo_id, numero_ot, tipo_mantenimiento, horometro_al_ingreso,
        fecha_hora_ingreso_taller, fecha_hora_salida_taller,
        fecha_inicio_bodega, fecha_fin_bodega,
        fallas_encontradas, nivel_criticidad, causa_raiz,
        trabajos_realizados, trabajos_detalle,
        observaciones_seguridad,
        estado_equipo_al_cierre, proxima_fecha_mantenimiento,
        costo_total_mantenimiento, supervisor_id, adjuntos,
        tecnicos_ids = [], repuestos = [],
      } = data;

      // Normalizar trabajos_detalle (puede llegar como string JSON del FormData)
      let trabajosDetalleNorm = [];
      if (trabajos_detalle) {
        trabajosDetalleNorm = typeof trabajos_detalle === 'string'
          ? JSON.parse(trabajos_detalle)
          : trabajos_detalle;
      }

      const res = await client.query(`
        INSERT INTO historial_equipo (
          equipo_id, orden_trabajo_id, numero_ot, tipo_mantenimiento, horometro_al_ingreso,
          fecha_hora_ingreso_taller, fecha_hora_salida_taller,
          fecha_inicio_bodega, fecha_fin_bodega,
          fallas_encontradas, nivel_criticidad, causa_raiz,
          trabajos_realizados, trabajos_detalle, observaciones_seguridad,
          estado_equipo_al_cierre, proxima_fecha_mantenimiento,
          costo_total_mantenimiento, supervisor_id, adjuntos, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        ) RETURNING *
      `, [
        equipoId,
        orden_trabajo_id || null,
        numero_ot || null,
        tipo_mantenimiento,
        horometro_al_ingreso || 0,
        fecha_hora_ingreso_taller || null,
        fecha_hora_salida_taller || null,
        fecha_inicio_bodega || null,
        fecha_fin_bodega || null,
        fallas_encontradas || null,
        nivel_criticidad || null,
        causa_raiz || null,
        trabajos_realizados || null,
        JSON.stringify(trabajosDetalleNorm),
        observaciones_seguridad || null,
        estado_equipo_al_cierre || null,
        proxima_fecha_mantenimiento || null,
        costo_total_mantenimiento || 0,
        supervisor_id || null,
        adjuntos && adjuntos.length > 0 ? adjuntos : null,
        userId,
      ]);

      const historial = res.rows[0];

      // Insertar técnicos
      for (const tecnicoId of tecnicos_ids) {
        await client.query(
          `INSERT INTO historial_tecnicos (historial_id, empleado_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [historial.id, tecnicoId]
        );
      }

      // Insertar repuestos
      for (const rep of repuestos) {
        await client.query(`
          INSERT INTO historial_repuestos (
            historial_id,
            retirado_nombre, retirado_codigo, retirado_numero_serie,
            retirado_motivo, retirado_estado,
            instalado_nombre, instalado_codigo, instalado_numero_serie,
            instalado_procedencia, instalado_garantia_hasta, instalado_costo_unitario
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [
          historial.id,
          rep.retirado_nombre || null, rep.retirado_codigo || null, rep.retirado_numero_serie || null,
          rep.retirado_motivo || null, rep.retirado_estado || null,
          rep.instalado_nombre || null, rep.instalado_codigo || null, rep.instalado_numero_serie || null,
          rep.instalado_procedencia || null, rep.instalado_garantia_hasta || null,
          rep.instalado_costo_unitario || 0,
        ]);
      }

      return historial;
    });
  }

  // ─── Actualizar registro (solo si OT no cerrada) ──────────────
  async update(historialId, data) {
    const allowed = [
      'tipo_mantenimiento', 'horometro_al_ingreso',
      'fecha_hora_ingreso_taller', 'fecha_hora_salida_taller',
      'fecha_inicio_bodega', 'fecha_fin_bodega',
      'fallas_encontradas', 'nivel_criticidad', 'causa_raiz',
      'trabajos_realizados', 'trabajos_detalle', 'observaciones_seguridad',
      'estado_equipo_al_cierre', 'proxima_fecha_mantenimiento',
      'costo_total_mantenimiento', 'supervisor_id', 'adjuntos', 'ot_cerrada',
    ];

    return await withTransaction(async (client) => {
      // Verificar que no esté cerrada
      const check = await client.query(
        `SELECT ot_cerrada FROM historial_equipo WHERE id = $1`,
        [historialId]
      );
      if (!check.rows[0]) return null;
      if (check.rows[0].ot_cerrada) throw new Error('OT_CERRADA');

      // Campos JSONB que deben serializarse explícitamente a string
      const jsonbFields = ['trabajos_detalle'];

      // Construir SET dinámico
      const fields = [];
      const values = [];
      let i = 1;
      for (const key of allowed) {
        if (key in data) {
          fields.push(`${key} = $${i++}`);
          let val = data[key] === '' ? null : data[key];
          // Serializar arrays/objetos para columnas JSONB
          if (jsonbFields.includes(key) && val !== null && typeof val !== 'string') {
            val = JSON.stringify(val);
          }
          values.push(val);
        }
      }

      if (fields.length === 0) return this.findById(null, historialId);

      fields.push(`updated_at = NOW()`);
      values.push(historialId);
      const res = await client.query(
        `UPDATE historial_equipo SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      // Re-sync técnicos si se envían
      if ('tecnicos_ids' in data) {
        await client.query(`DELETE FROM historial_tecnicos WHERE historial_id = $1`, [historialId]);
        for (const tecnicoId of (data.tecnicos_ids || [])) {
          await client.query(
            `INSERT INTO historial_tecnicos (historial_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [historialId, tecnicoId]
          );
        }
      }

      return res.rows[0] || null;
    });
  }

  // ─── Agregar repuestos a una intervención existente ──────────
  async addRepuestos(historialId, repuestos) {
    const check = await query(
      `SELECT ot_cerrada FROM historial_equipo WHERE id = $1`,
      [historialId]
    );
    if (!check.rows[0]) return [];
    if (check.rows[0].ot_cerrada) throw new Error('OT_CERRADA');

    const results = [];
    for (const rep of repuestos) {
      const res = await query(`
        INSERT INTO historial_repuestos (
          historial_id,
          retirado_nombre, retirado_codigo, retirado_numero_serie,
          retirado_motivo, retirado_estado,
          instalado_nombre, instalado_codigo, instalado_numero_serie,
          instalado_procedencia, instalado_garantia_hasta, instalado_costo_unitario
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [
        historialId,
        rep.retirado_nombre || null, rep.retirado_codigo || null, rep.retirado_numero_serie || null,
        rep.retirado_motivo || null, rep.retirado_estado || null,
        rep.instalado_nombre || null, rep.instalado_codigo || null, rep.instalado_numero_serie || null,
        rep.instalado_procedencia || null, rep.instalado_garantia_hasta || null,
        rep.instalado_costo_unitario || 0,
      ]);
      results.push(res.rows[0]);
    }
    return results;
  }

  // ─── Técnicos disponibles ─────────────────────────────────────
  async findTecnicosDisponibles() {
    const res = await query(`
      SELECT id, full_name, identification, phone, position
      FROM employees
      WHERE LOWER(status) = 'activo'
      ORDER BY full_name ASC
    `);
    return res.rows;
  }
}
