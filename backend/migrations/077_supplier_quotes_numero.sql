-- Migration 077: Añadir numero de cotizacion del proveedor
-- Fecha: 2026-07-06

BEGIN;

ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS numero_cotizacion VARCHAR(100);

COMMIT;
