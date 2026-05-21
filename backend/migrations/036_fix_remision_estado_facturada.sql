-- ============================================================
-- Migración 036: Agregar estado FACTURADA a remisiones
-- La migración 035 agregó el flujo Servicios → Facturación
-- pero el CHECK constraint de remisiones no permite FACTURADA.
-- ============================================================

BEGIN;

ALTER TABLE remisiones
  DROP CONSTRAINT IF EXISTS remisiones_estado_check;

ALTER TABLE remisiones
  ADD CONSTRAINT remisiones_estado_check
    CHECK (estado IN ('BORRADOR', 'PENDIENTE', 'REALIZADA', 'LIQUIDADA', 'FACTURADA', 'ANULADO'));

COMMIT;
