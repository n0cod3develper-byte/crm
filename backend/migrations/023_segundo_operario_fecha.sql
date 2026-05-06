-- ============================================================
-- Migración 023: Fecha acordada para segundo operario
-- ============================================================

ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS segundo_fecha_acordada DATE;
