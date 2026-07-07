-- Migration 074: Añadir proveedor a ítems de cotización de proveedores y hacer opcional el de la cabecera
ALTER TABLE supplier_quotes ALTER COLUMN proveedor_id DROP NOT NULL;
ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL;
