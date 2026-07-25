-- ============================================================
-- Migración 094: Actividades para OTs Correctivas + campo codigo en PM
-- Fecha: 2026-07-25
-- ============================================================

-- 1. Agregar columna 'codigo' a ot_pm_actividades (para OTs preventivas)
--    El PDF ya referencia a.codigo pero la columna no existía.
ALTER TABLE ot_pm_actividades ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);

-- 2. Nueva tabla para actividades de OTs correctivas (ingresadas libremente por el usuario)
CREATE TABLE IF NOT EXISTS ot_actividades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  orden            INTEGER NOT NULL DEFAULT 0,
  codigo           VARCHAR(50),
  descripcion      VARCHAR(500) NOT NULL DEFAULT '',
  estado           VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado IN ('PENDIENTE','EN_PROCESO','COMPLETADA','OMITIDA')),
  tecnico_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  observaciones    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_actividades_ot ON ot_actividades(orden_trabajo_id);
