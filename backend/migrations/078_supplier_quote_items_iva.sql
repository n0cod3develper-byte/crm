-- Migration 078: Añadir campo IVA por ítem en supplier_quote_items
-- Fecha: 2026-07-07

BEGIN;

ALTER TABLE supplier_quote_items
  ADD COLUMN IF NOT EXISTS iva DECIMAL(5,2) DEFAULT 19;

COMMIT;
