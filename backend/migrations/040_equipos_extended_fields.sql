-- ============================================================
-- Migración 040: Módulo de Equipos — Campos Extendidos, Auditoría y Foto
-- Fecha: 2026-05-28
-- ============================================================

BEGIN;

-- 1. ALTER TABLE equipos para añadir campos extendidos
ALTER TABLE equipos

  -- ── IDENTIFICACIÓN ────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS serie             VARCHAR(100),

  -- ── CLASIFICACIÓN DEL EQUIPO ──────────────────────────────────
  ADD COLUMN IF NOT EXISTS tipo_equipo       VARCHAR(30)
    CHECK (tipo_equipo IN (
      'MONTACARGAS',
      'ELEVADOR',
      'CAMIONETA',
      'AMBULANCIA',
      'VEHICULO'
    )),

  -- ── ESPECIFICACIONES TÉCNICAS ─────────────────────────────────
  ADD COLUMN IF NOT EXISTS capacidad_nominal DECIMAL(5,1)
    CHECK (capacidad_nominal IN (
      1.5, 2.0, 2.5, 3.0, 3.5,
      4.0, 4.5, 5.0, 5.5, 6.0,
      6.5, 7.0
    )),

  ADD COLUMN IF NOT EXISTS tipo_mastil       VARCHAR(20)
    CHECK (tipo_mastil IN (
      'SIMPLEX',
      'DUPLEX',
      'TRIPLEX',
      'CUADRUPLEX'
    )),

  ADD COLUMN IF NOT EXISTS altura_maxima     DECIMAL(4,1)
    CHECK (altura_maxima BETWEEN 1.0 AND 10.0),

  ADD COLUMN IF NOT EXISTS tipo_propulsion   VARCHAR(30)
    CHECK (tipo_propulsion IN (
      'GLP',
      'GASOLINA',
      'ELECTRICO_BATERIA_LITIO',
      'ELECTRICO_BATERIA_PLOMO'
    )),

  -- ── MÉTRICAS OPERATIVAS ───────────────────────────────────────
  ADD COLUMN IF NOT EXISTS horometro_actual  DECIMAL(10,1) DEFAULT 0,

  ADD COLUMN IF NOT EXISTS odometro          DECIMAL(10,1) DEFAULT 0,

  ADD COLUMN IF NOT EXISTS fecha_horometro   DATE,

  ADD COLUMN IF NOT EXISTS fecha_odometro    DATE,

  -- ── UBICACIÓN FÍSICA ──────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS ubicacion_fisica  VARCHAR(500),

  ADD COLUMN IF NOT EXISTS ciudad_ubicacion  VARCHAR(100),

  -- ── ESTADO OPERATIVO ──────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS estado            VARCHAR(25) DEFAULT 'OPERATIVO'
    CHECK (estado IN (
      'OPERATIVO',
      'EN_MANTENIMIENTO',
      'FUERA_DE_SERVICIO',
      'ALQUILADO',
      'RETIRADO'
    )),

  ADD COLUMN IF NOT EXISTS fecha_cambio_estado DATE,

  ADD COLUMN IF NOT EXISTS motivo_estado     TEXT,

  -- ── FOTO DEL EQUIPO ───────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS foto_path         VARCHAR(500),

  ADD COLUMN IF NOT EXISTS foto_url          VARCHAR(500),

  ADD COLUMN IF NOT EXISTS foto_thumb_url    VARCHAR(500),

  -- ── AUDITORÍA ─────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS actualizado_por   VARCHAR(150);

-- 2. Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_equipos_estado
  ON equipos(estado);

CREATE INDEX IF NOT EXISTS idx_equipos_tipo
  ON equipos(tipo_equipo);

CREATE INDEX IF NOT EXISTS idx_equipos_empresa_estado
  ON equipos(empresa_id, estado);

CREATE INDEX IF NOT EXISTS idx_equipos_propulsion
  ON equipos(tipo_propulsion);

-- 3. Actualizar registros existentes con estado OPERATIVO por defecto
UPDATE equipos
SET estado = 'OPERATIVO'
WHERE estado IS NULL;

-- 4. Migrar el combustible al nuevo tipo_propulsion por retrocompatibilidad
UPDATE equipos SET tipo_propulsion =
  CASE combustible
    WHEN 'GLP'       THEN 'GLP'
    WHEN 'Gasolina'  THEN 'GASOLINA'
    WHEN 'Eléctrico' THEN 'ELECTRICO_BATERIA_PLOMO'
    WHEN 'Híbrido'   THEN 'ELECTRICO_BATERIA_LITIO'
    ELSE NULL
  END
WHERE tipo_propulsion IS NULL
  AND combustible IS NOT NULL;

-- 5. Tabla de historial de estado para auditoría
CREATE TABLE IF NOT EXISTS equipos_historial_estado (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(25),
  estado_nuevo    VARCHAR(25) NOT NULL,
  motivo          TEXT,
  cambiado_por    VARCHAR(150),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_estado_equipo
  ON equipos_historial_estado(equipo_id, created_at DESC);

-- 6. Crear o reemplazar vista completa equipos_completo
CREATE OR REPLACE VIEW equipos_completo AS
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
  -- Empresa (companies table)
  emp.id            AS empresa_id,
  emp.name          AS empresa_nombre,
  emp.nit           AS empresa_nit,
  -- Última OT (para mostrar el horómetro más reciente)
  (
    SELECT MAX(ot.horometro_final)
    FROM ordenes_trabajo ot
    WHERE ot.equipo_id = e.id
      AND ot.horometro_final IS NOT NULL
  ) AS horometro_ultimo_ot,
  -- Conteo de OTs históricas
  (
    SELECT COUNT(*)
    FROM ordenes_trabajo ot
    WHERE ot.equipo_id = e.id
  ) AS total_ots,
  -- Próximo preventivo (proyectado)
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
