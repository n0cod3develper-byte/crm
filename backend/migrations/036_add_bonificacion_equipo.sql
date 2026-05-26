-- ============================================================
-- Migración 036: Campo bonificación por hora en Equipos
-- ============================================================

ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS bonificacion_por_hora DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN equipos.bonificacion_por_hora IS
  'Valor COP que se le paga al operario por cada hora trabajada con este equipo';
