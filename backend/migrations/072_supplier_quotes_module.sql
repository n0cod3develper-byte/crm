CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for supplier quotes
CREATE TABLE supplier_quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consecutivo VARCHAR(50) NOT NULL,
    proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR', -- BORRADOR, CREADO, APROBADO, ANULADO
    margen_utilidad DECIMAL(5,2) NOT NULL DEFAULT 23.00,
    subtotal DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for items of supplier quotes
CREATE TABLE supplier_quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_quote_id UUID NOT NULL REFERENCES supplier_quotes(id) ON DELETE CASCADE,
    inventario_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    cantidad DECIMAL(10,2) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    comentarios TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX idx_supplier_quotes_proveedor ON supplier_quotes(proveedor_id);
CREATE INDEX idx_supplier_quotes_company ON supplier_quotes(company_id);
CREATE INDEX idx_supplier_quote_items_quote ON supplier_quote_items(supplier_quote_id);
