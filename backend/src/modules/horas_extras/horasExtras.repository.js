/**
 * horasExtras.repository.js
 * Queries SQL para configuración, consulta de jornadas, liquidaciones y detalle.
 */

import { query } from '../../config/database.js';

export class HorasExtrasRepository {
  // ─── Configuración ────────────────────────────────────────

  async getConfiguracion() {
    const res = await query(
      `SELECT * FROM horas_extras_configuracion
       WHERE activo = TRUE
       ORDER BY dia_aplicacion, tipo_hora`
    );
    return res.rows;
  }

  async getConfiguracionById(id) {
    const res = await query(
      `SELECT * FROM horas_extras_configuracion WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async updateConfiguracion(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = [
      'nombre', 'porcentaje', 'hora_inicio', 'hora_fin',
      'jornada_maxima_minutos', 'jornada_ordinaria_decimal', 'es_liquidable', 'activo'
    ];

    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return this.getConfiguracionById(id);

    values.push(id);
    const res = await query(
      `UPDATE horas_extras_configuracion
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING *`,
      values
    );
    return res.rows[0] || null;
  }

  // ─── Festivos ─────────────────────────────────────────────

  async getFestivos(anio) {
    const conditions = ['activo = TRUE'];
    const params = [];
    let i = 1;
    if (anio) {
      conditions.push(`anio = $${i++}`);
      params.push(anio);
    }
    const res = await query(
      `SELECT * FROM festivos_colombia WHERE ${conditions.join(' AND ')} ORDER BY fecha ASC`,
      params
    );
    return res.rows;
  }

  // ─── Jornadas Laborales ───────────────────────────────────

  async createJornada(data) {
    const res = await query(
      `INSERT INTO jornadas_laborales (
         empleado_id, remision_id, fecha_trabajo, hora_entrada, hora_salida, observacion,
         salario_mensual, valor_hora_base, horas_trabajadas, total_horas_ordinarias,
         total_horas_extras, total_rno, total_liquidado, minutos_descuento
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
       ) RETURNING *`,
      [
        data.empleado_id, data.remision_id || null, data.fecha_trabajo,
        data.hora_entrada, data.hora_salida, data.observacion || null,
        data.salario_mensual, data.valor_hora_base, data.horas_trabajadas,
        data.total_horas_ordinarias, data.total_horas_extras, data.total_rno, data.total_liquidado, data.minutos_descuento
      ]
    );
    return res.rows[0];
  }

  async saveJornadaDetalle(jornadaId, segmentos) {
    // Limpiar si existiera
    await query(`DELETE FROM jornadas_laborales_detalle WHERE jornada_id = $1`, [jornadaId]);

    for (const seg of segmentos) {
      await query(
        `INSERT INTO jornadas_laborales_detalle (
           jornada_id, tipo_hora, hora_inicio, hora_fin, minutos, horas_decimal,
           porcentaje, valor_hora, subtotal, es_liquidable
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          jornadaId, seg.tipo_hora, seg.hora_inicio, seg.hora_fin, seg.minutos,
          seg.horas_decimal, seg.porcentaje, seg.valor_hora, seg.subtotal, seg.es_liquidable
        ]
      );
    }
  }

  // Upsert para automatización o reprocesamiento
  async upsertJornada(data, segmentos) {
    let check;
    // Si se pasa un jornada_id directo (edición desde modal), usarlo directamente
    if (data.jornada_id) {
      check = await query(
        `SELECT id FROM jornadas_laborales WHERE id = $1`,
        [data.jornada_id]
      );
    } else if (data.remision_id) {
      check = await query(
        `SELECT id FROM jornadas_laborales WHERE empleado_id = $1 AND remision_id = $2`,
        [data.empleado_id, data.remision_id]
      );
    } else {
      check = await query(
        `SELECT id FROM jornadas_laborales WHERE empleado_id = $1 AND fecha_trabajo = $2 AND remision_id IS NULL`,
        [data.empleado_id, data.fecha_trabajo]
      );
    }

    let jornadaId;
    if (check.rows.length > 0) {
      jornadaId = check.rows[0].id;
      await query(
        `UPDATE jornadas_laborales SET 
           remision_id = COALESCE($1, remision_id),
           hora_entrada = $2, hora_salida = $3, observacion = COALESCE($4, observacion),
           salario_mensual = $5, valor_hora_base = $6, horas_trabajadas = $7,
           total_horas_ordinarias = $8, total_horas_extras = $9, total_rno = $10, total_liquidado = $11,
           minutos_descuento = $12,
           updated_at = NOW()
         WHERE id = $13`,
        [
          data.remision_id || null, data.hora_entrada, data.hora_salida, data.observacion || null,
          data.salario_mensual, data.valor_hora_base, data.horas_trabajadas,
          data.total_horas_ordinarias, data.total_horas_extras, data.total_rno, data.total_liquidado,
          data.minutos_descuento,
          jornadaId
        ]
      );
    } else {
      const inserted = await this.createJornada(data);
      jornadaId = inserted.id;
    }

    await this.saveJornadaDetalle(jornadaId, segmentos);
    return jornadaId;
  }

  async deleteJornada(id) {
    await query(`DELETE FROM jornadas_laborales_detalle WHERE jornada_id = $1`, [id]);
    const res = await query(`DELETE FROM jornadas_laborales WHERE id = $1 RETURNING id`, [id]);
    return res.rows[0];
  }

  async updateObservacion(id, observacion) {
    const res = await query(
      `UPDATE jornadas_laborales SET observacion = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [observacion, id]
    );
    return res.rows[0];
  }

  // ─── Consultas para Informes ──────────────────────────────

  async getInformeGestionHumana({ fecha_inicio, fecha_fin, operario_id }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`jl.fecha_trabajo >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`jl.fecha_trabajo <= $${i++}`);
      params.push(fecha_fin);
    }
    if (operario_id) {
      conditions.push(`jl.empleado_id = $${i++}`);
      params.push(operario_id);
    }

    // Consulta enfocada 100% en jornadas laborales, sin depender de la existencia de remisión
    const sql = `
      SELECT 
        jl.id,
        jl.remision_id,
        jl.fecha_trabajo,
        jl.hora_entrada,
        jl.hora_salida,
        em.id AS operario_id,
        em.full_name AS operario_nombre,
        em.position AS cargo,
        em.numero_documento,
        r.numero_remision,
        jl.observacion,
        jl.horas_trabajadas,
        jl.total_horas_ordinarias,
        jl.total_horas_extras,
        jl.total_rno,
        jl.total_liquidado,
        jl.salario_mensual,
        jl.valor_hora_base,
        jl.minutos_descuento,
        EXTRACT(DOW FROM jl.fecha_trabajo) AS dia_semana,
        CASE WHEN fc.fecha IS NOT NULL THEN TRUE ELSE FALSE END AS es_festivo,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'ORDINARIA_DIURNA' THEN jld.minutos ELSE 0 END), 0) AS min_ord_diurna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'ORDINARIA_NOCTURNA' THEN jld.minutos ELSE 0 END), 0) AS min_ord_nocturna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'DOMINICAL_FESTIVA_DIURNA' THEN jld.minutos ELSE 0 END), 0) AS min_dom_diurna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'DOMINICAL_FESTIVA_NOCTURNA' THEN jld.minutos ELSE 0 END), 0) AS min_dom_nocturna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'EXTRA_DIURNA' THEN jld.minutos ELSE 0 END), 0) AS min_extra_diurna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'EXTRA_NOCTURNA' THEN jld.minutos ELSE 0 END), 0) AS min_extra_nocturna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'EXTRA_DOMINICAL_FESTIVA_DIURNA' THEN jld.minutos ELSE 0 END), 0) AS min_extra_dom_diurna,
        COALESCE(SUM(CASE WHEN jld.tipo_hora = 'EXTRA_DOMINICAL_FESTIVA_NOCTURNA' THEN jld.minutos ELSE 0 END), 0) AS min_extra_dom_nocturna
      FROM jornadas_laborales jl
      JOIN employees em ON em.id = jl.empleado_id
      LEFT JOIN remisiones r ON r.id = jl.remision_id
      LEFT JOIN festivos_colombia fc ON fc.fecha = jl.fecha_trabajo AND fc.activo = TRUE
      LEFT JOIN jornadas_laborales_detalle jld ON jld.jornada_id = jl.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY jl.id, em.id, r.id, fc.fecha
      ORDER BY jl.fecha_trabajo DESC, em.full_name ASC
    `;

    const res = await query(sql, params);
    return res.rows;
  }

  async getDetalleJornada(jornadaId) {
    const res = await query(
      `SELECT * FROM jornadas_laborales_detalle
       WHERE jornada_id = $1
       ORDER BY tipo_hora ASC`,
      [jornadaId]
    );
    return res.rows;
  }

  // Agrupado por persona
  async getResumenAgrupado({ fecha_inicio, fecha_fin, operario_id }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (fecha_inicio) {
      conditions.push(`jl.fecha_trabajo >= $${i++}`);
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`jl.fecha_trabajo <= $${i++}`);
      params.push(fecha_fin);
    }
    if (operario_id) {
      conditions.push(`jl.empleado_id = $${i++}`);
      params.push(operario_id);
    }

    const sql = `
      SELECT 
        em.id AS operario_id,
        em.full_name AS operario_nombre,
        em.numero_documento,
        COUNT(jl.id) AS dias_trabajados,
        SUM(jl.total_horas_extras) AS total_he_periodo,
        SUM(jl.total_rno) AS total_rno_periodo,
        SUM(jl.horas_trabajadas) AS total_horas_periodo,
        SUM(jl.total_liquidado) AS total_liquidado_periodo,
        MAX(CASE WHEN jl.total_horas_extras > 0 THEN jl.fecha_trabajo ELSE NULL END) AS ultima_fecha_he
      FROM jornadas_laborales jl
      JOIN employees em ON em.id = jl.empleado_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY em.id, em.full_name, em.numero_documento
      ORDER BY em.full_name ASC
    `;
    const res = await query(sql, params);
    return res.rows;
  }

  async getOperariosConJornadas() {
    const res = await query(
      `SELECT id, full_name
       FROM employees
       WHERE status = 'Activo'
       ORDER BY full_name ASC`
    );
    return res.rows;
  }
}
