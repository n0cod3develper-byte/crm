-- Migration 073: Añadir proveedor a ítems de cotización de clientes
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL;
