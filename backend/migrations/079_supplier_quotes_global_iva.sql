-- Migration 079: Añadir campo IVA global en supplier_quotes
-- Fecha: 2026-07-07

BEGIN;

ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS iva DECIMAL(5,2) DEFAULT 19.00;

COMMIT;
