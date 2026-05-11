-- ============================================================
-- Migración 016: Agregar numero_equipo a tabla equipos
-- ============================================================

ALTER TABLE equipos ADD COLUMN IF NOT EXISTS numero_equipo VARCHAR(50);
