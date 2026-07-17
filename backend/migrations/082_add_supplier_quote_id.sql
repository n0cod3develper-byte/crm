-- Migration 082: Agregar supplier_quote_id a quote_items
-- Permite rastrear la cotización original del proveedor.

BEGIN;

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS supplier_quote_id UUID REFERENCES supplier_quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_supplier_quote ON quote_items(supplier_quote_id);

COMMIT;
