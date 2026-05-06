-- ============================================================
-- Migración 022: Horómetros para segundo operario
-- ============================================================

ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS segundo_horometro_salida NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS segundo_horometro_regreso NUMERIC(10, 2);
