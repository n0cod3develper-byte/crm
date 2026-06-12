-- ============================================================
-- Migración 058: Añadir descripción a ítems y campos de recargo simplificados
-- ============================================================

ALTER TABLE remision_servicios 
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

ALTER TABLE remisiones 
  ADD COLUMN IF NOT EXISTS horas_ordinarias DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_hora_ordinaria DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_recargo DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_hora_recargo DECIMAL(12,2) DEFAULT 0;
