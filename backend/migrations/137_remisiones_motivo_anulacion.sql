-- Migración 137: Columna motivo_anulacion en remisiones
-- CARGAR S.A.S. - Módulo Servicios & Remisiones

ALTER TABLE remisiones 
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

COMMENT ON COLUMN remisiones.motivo_anulacion IS 'Motivo obligatorio registrado al anular una remisión';
