-- ============================================================
-- Migración 062: Equipos — Campo Bonificación por Hora
-- Fecha: 2026-06-11
-- ============================================================

BEGIN;

-- 1. Agregar columna bonificacion_hora a la tabla equipos
ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS bonificacion_hora DECIMAL(12, 2) DEFAULT 0;

-- 2. Recrear vista equipos_completo incluyendo bonificacion_hora
-- (DROP + CREATE porque CREATE OR REPLACE no permite agregar columnas en medio)
DROP VIEW IF EXISTS equipos_completo CASCADE;
CREATE VIEW equipos_completo AS
SELECT
  e.id,
  e.marca,
  e.modelo,
  e.serial,
  e.serie,
  e.color,
  -- Clasificación
  e.tipo_equipo,
  CASE e.tipo_equipo
    WHEN 'MONTACARGAS' THEN 'Montacargas'
    WHEN 'ELEVADOR'    THEN 'Elevador'
    WHEN 'CAMIONETA'   THEN 'Camioneta'
    WHEN 'AMBULANCIA'  THEN 'Ambulancia'
    WHEN 'VEHICULO'    THEN 'Vehículo'
  END AS tipo_equipo_label,
  -- Especificaciones técnicas
  e.capacidad_carga,
  e.capacidad_nominal,
  e.motor,
  e.combustible,
  e.tipo_propulsion,
  CASE e.tipo_propulsion
    WHEN 'GLP'                    THEN 'GLP'
    WHEN 'GASOLINA'               THEN 'Gasolina'
    WHEN 'ELECTRICO_BATERIA_LITIO' THEN 'Eléctrico / Batería Litio'
    WHEN 'ELECTRICO_BATERIA_PLOMO' THEN 'Eléctrico / Batería Plomo'
  END AS tipo_propulsion_label,
  e.tipo_mastil,
  CASE e.tipo_mastil
    WHEN 'SIMPLEX'    THEN 'Simplex'
    WHEN 'DUPLEX'     THEN 'Dúplex'
    WHEN 'TRIPLEX'    THEN 'Tríplex'
    WHEN 'CUADRUPLEX' THEN 'Cuádruple'
  END AS tipo_mastil_label,
  e.altura_maxima,
  -- Métricas operativas
  e.horometro_actual,
  e.odometro,
  e.fecha_horometro,
  e.fecha_odometro,
  -- SOAT
  e.soat_vigente,
  e.soat_vencimiento,
  -- Bonificación por hora
  e.bonificacion_hora,
  -- Ubicación
  e.ubicacion_fisica,
  e.ciudad_ubicacion,
  -- Estado
  e.estado,
  CASE e.estado
    WHEN 'OPERATIVO'         THEN 'Operativo'
    WHEN 'EN_MANTENIMIENTO'  THEN 'En Mantenimiento'
    WHEN 'FUERA_DE_SERVICIO' THEN 'Fuera de Servicio'
    WHEN 'ALQUILADO'         THEN 'Alquilado'
    WHEN 'RETIRADO'          THEN 'Retirado'
  END AS estado_label,
  e.fecha_cambio_estado,
  e.motivo_estado,
  -- Foto
  e.foto_url,
  e.foto_thumb_url,
  -- Empresa
  emp.id            AS empresa_id,
  emp.name          AS empresa_nombre,
  emp.nit           AS empresa_nit,
  -- Última OT
  (
    SELECT MAX(ot.horometro_final)
    FROM ordenes_trabajo ot
    WHERE ot.equipo_id = e.id
      AND ot.horometro_final IS NOT NULL
  ) AS horometro_ultimo_ot,
  -- Conteo de OTs
  (
    SELECT COUNT(*)
    FROM ordenes_trabajo ot
    WHERE ot.equipo_id = e.id
  ) AS total_ots,
  -- Próximo preventivo
  (
    SELECT COALESCE(
      (
        SELECT MIN(ot.horometro_frecuencia)
        FROM ordenes_trabajo ot
        WHERE ot.equipo_id = e.id
          AND ot.tipo_mantenimiento = 'PREVENTIVO'
          AND ot.estado IN ('ABIERTA', 'EN_PROCESO')
          AND ot.horometro_frecuencia IS NOT NULL
      ),
      (
        SELECT ot.horometro_final + COALESCE(f.horas, 250)
        FROM ordenes_trabajo ot
        LEFT JOIN pm_frecuencias f ON f.id = ot.pm_frecuencia_id
        WHERE ot.equipo_id = e.id
          AND ot.tipo_mantenimiento = 'PREVENTIVO'
          AND ot.estado = 'LIQUIDADA'
          AND ot.horometro_final IS NOT NULL
        ORDER BY ot.horometro_final DESC
        LIMIT 1
      ),
      e.horometro_actual + 250
    )
  ) AS proximo_preventivo,
  e.deleted_at,
  e.created_at,
  e.updated_at,
  e.actualizado_por
FROM equipos      e
JOIN companies    emp ON emp.id = e.empresa_id;

COMMIT;
