-- ============================================================
-- Migración 039: Corregir encoding del CHECK de tipo_servicio
-- La migración 037 grabó el CHECK con caracteres corruptos
-- ('EsporâÃ­dico' en lugar de 'Esporádico').
-- ============================================================

BEGIN;

ALTER TABLE catalogo_servicios
  DROP CONSTRAINT IF EXISTS catalogo_servicios_tipo_servicio_check;

ALTER TABLE catalogo_servicios
  ADD CONSTRAINT catalogo_servicios_tipo_servicio_check
    CHECK (tipo_servicio IN ('Fijo', 'Esporádico', 'Otras Ventas'));

COMMIT;
