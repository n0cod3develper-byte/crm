-- Migration 075: Ítems de cotización de proveedores independientes
ALTER TABLE supplier_quotes ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS margen_utilidad DECIMAL(5,2) DEFAULT 0;
ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS descripcion_manual VARCHAR(255);
ALTER TABLE supplier_quote_items ALTER COLUMN inventario_id DROP NOT NULL;
