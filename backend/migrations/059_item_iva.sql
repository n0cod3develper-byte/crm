-- ============================================================
-- Migración 059: Añadir aplica_iva a cada ítem de servicio
-- ============================================================

ALTER TABLE remision_servicios 
  ADD COLUMN IF NOT EXISTS aplica_iva BOOLEAN DEFAULT false;
