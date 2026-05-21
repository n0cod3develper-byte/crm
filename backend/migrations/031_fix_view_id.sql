-- ============================================================
-- Migración 031: Corrige alias en vista resumen_turnos_tecnicos
-- La vista original usaba "t.id AS turno_id", pero el frontend
-- espera "t.id AS id" (como en la tabla base).
-- ============================================================

DROP VIEW IF EXISTS resumen_turnos_tecnicos;
CREATE VIEW resumen_turnos_tecnicos AS
SELECT
  t.id                    AS id,
  t.fecha_turno,
  t.estado,
  e.id                    AS empleado_id,
  e.full_name             AS nombre_tecnico,
  e.position              AS cargo,
  t.inicio_turno,
  t.fin_turno,
  t.tiempo_total_min,
  ROUND(t.tiempo_total_min::NUMERIC / 60, 2)  AS horas_totales,
  t.jornada_normal_min,
  t.minutos_extras,
  t.horas_extras,
  t.horas_extras_diurnas,
  t.horas_extras_nocturnas,
  t.alerta_limite_legal,
  COUNT(ts.id)                                            AS total_servicios,
  COUNT(ts.orden_trabajo_id)                              AS total_ots_atendidas,
  COALESCE(SUM(ts.tiempo_servicio_efectivo_min), 0)       AS min_servicio_efectivo,
  COALESCE(SUM(
    COALESCE(ts.tiempo_desplazamiento_ida_min, 0) +
    COALESCE(ts.tiempo_desplazamiento_vuelta_min, 0)
  ), 0)                                                   AS min_total_desplazamiento,
  CASE
    WHEN t.tiempo_total_min > 0 THEN
      ROUND(
        COALESCE(SUM(ts.tiempo_servicio_efectivo_min), 0)::NUMERIC
        / t.tiempo_total_min * 100, 1
      )
    ELSE 0
  END                                                     AS pct_eficiencia,
  (
    SELECT row_to_json(sub) FROM (
      SELECT
        sv.id,
        sv.estado_servicio,
        ot.consecutivo AS ot_consecutivo,
        c.name AS empresa
      FROM turno_servicios sv
      LEFT JOIN ordenes_trabajo ot ON ot.id = sv.orden_trabajo_id
      LEFT JOIN companies c ON c.id = ot.empresa_id
      WHERE sv.turno_id = t.id AND sv.estado_servicio != 'COMPLETADO'
      LIMIT 1
    ) sub
  )                                                       AS servicio_activo,
  t.aprobado_por,
  t.fecha_aprobacion,
  t.observaciones,
  t.created_at
FROM turnos_tecnicos     t
JOIN employees           e  ON e.id = t.empleado_id
LEFT JOIN turno_servicios ts ON ts.turno_id = t.id
GROUP BY t.id, e.id
ORDER BY t.fecha_turno DESC, e.full_name ASC;
