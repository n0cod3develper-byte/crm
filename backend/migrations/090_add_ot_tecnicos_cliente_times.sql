-- ============================================================
-- Migración 090: Agregar campos de llegada/salida cliente en ot_tecnicos
-- ============================================================

ALTER TABLE ot_tecnicos
ADD COLUMN IF NOT EXISTS hora_llegada_cliente TIME,
ADD COLUMN IF NOT EXISTS hora_salida_cliente TIME;
