-- ============================================================
-- Migración 018: Agregar cantidad a catalogo_servicios
-- ============================================================

ALTER TABLE catalogo_servicios ADD COLUMN IF NOT EXISTS cantidad INT DEFAULT 0;
