-- ============================================================
-- Migración 021: Tiempos para segundo operario
-- ============================================================

ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS segundo_hora_salida_cargar TIME,
  ADD COLUMN IF NOT EXISTS segundo_hora_llegada_cliente TIME,
  ADD COLUMN IF NOT EXISTS segundo_hora_salida_cliente TIME,
  ADD COLUMN IF NOT EXISTS segundo_hora_llegada_cargar TIME;
