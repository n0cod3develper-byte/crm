-- ============================================================
-- Migración 009: Fix horometro_frecuencia column type
-- Change from INT to NUMERIC to support decimal horómetro values
-- ============================================================

ALTER TABLE ordenes_trabajo
  ALTER COLUMN horometro_frecuencia TYPE NUMERIC(10,1);
