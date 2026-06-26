-- ============================================================
-- Migración 009: Servicio Fijo — Registro de Horas Diarias
-- ============================================================

-- 1. Marcar remisiones como "servicio fijo"
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS is_servicio_fijo BOOLEAN NOT NULL DEFAULT false;

-- 2. Tabla de registro diario de horas para servicios fijos
CREATE TABLE IF NOT EXISTS remision_dias_fijo (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id       UUID        NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  empleado_id       UUID        NOT NULL REFERENCES employees(id),
  fecha             DATE        NOT NULL,
  hora_entrada      TIME        NOT NULL,
  hora_salida       TIME        NOT NULL,
  -- Descuentos fijos: desayuno 2 min, almuerzo 30 min
  descuento_desayuno  BOOLEAN   NOT NULL DEFAULT true,
  descuento_almuerzo  BOOLEAN   NOT NULL DEFAULT false,
  minutos_descuento   SMALLINT  NOT NULL DEFAULT 0,   -- calculado en backend
  horas_brutas        DECIMAL(6,2) NOT NULL DEFAULT 0, -- calculado en backend
  horas_netas         DECIMAL(6,2) NOT NULL DEFAULT 0, -- calculado en backend
  bonificacion_hora   DECIMAL(12,2) NOT NULL DEFAULT 0,
  comision            DECIMAL(12,2) NOT NULL DEFAULT 0,
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  -- Permite un registro por operario por día; si cruza quincena se generan 2 filas con misma fecha/operario distintos ids
  UNIQUE (remision_id, empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_rdf_remision ON remision_dias_fijo(remision_id);
CREATE INDEX IF NOT EXISTS idx_rdf_fecha    ON remision_dias_fijo(fecha);
CREATE INDEX IF NOT EXISTS idx_rdf_empleado ON remision_dias_fijo(empleado_id);
