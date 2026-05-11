-- ============================================================
-- Migración 026: Mejoras historial_equipo
--   1. Horómetro al ingreso admite decimales (INTEGER → DECIMAL)
--   2. Nueva columna trabajos_detalle JSONB para múltiples
--      trabajos con fecha/hora individual
-- ============================================================

ALTER TABLE historial_equipo
  ALTER COLUMN horometro_al_ingreso TYPE DECIMAL(10,1) USING horometro_al_ingreso::DECIMAL;

ALTER TABLE historial_equipo
  ADD COLUMN IF NOT EXISTS trabajos_detalle JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN historial_equipo.horometro_al_ingreso IS
  'Horómetro del equipo al momento del ingreso (admite decimales)';

COMMENT ON COLUMN historial_equipo.trabajos_detalle IS
  'Array JSON de trabajos realizados: [{fecha_hora, descripcion}]';
