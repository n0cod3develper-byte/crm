-- Create quotes_servicios table
CREATE TABLE IF NOT EXISTS quotes_servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consecutivo VARCHAR(50) NOT NULL UNIQUE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    asunto VARCHAR(255),
    direccion_invitacion VARCHAR(255),
    ciudad_envio VARCHAR(100),
    catalogo_servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL,
    descripcion TEXT,
    estado VARCHAR(50) DEFAULT 'BORRADOR',
    subtotal NUMERIC(15,2) DEFAULT 0,
    iva_valor NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create quotes_servicios_items table
CREATE TABLE IF NOT EXISTS quotes_servicios_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_servicio_id UUID NOT NULL REFERENCES quotes_servicios(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(15,2) DEFAULT 1,
    valor_unitario NUMERIC(15,2) DEFAULT 0,
    subtotal NUMERIC(15,2) DEFAULT 0,
    aplica_iva BOOLEAN DEFAULT false,
    iva_valor NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Register module if missing
INSERT INTO modulos_sistema (nombre, slug)
SELECT 'Cotizaciones Servicios', 'cotizaciones-servicios'
WHERE NOT EXISTS (SELECT 1 FROM modulos_sistema WHERE nombre = 'Cotizaciones Servicios');

-- Insert consecutivo definition
INSERT INTO consecutivos (id, ultimo_valor)
SELECT 'cotizacion_servicio', 0
WHERE NOT EXISTS (SELECT 1 FROM consecutivos WHERE id = 'cotizacion_servicio');

-- Trigger for updated_at in quotes_servicios
CREATE OR REPLACE FUNCTION update_quotes_servicios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quotes_servicios_updated_at_trigger
BEFORE UPDATE ON quotes_servicios
FOR EACH ROW EXECUTE FUNCTION update_quotes_servicios_updated_at();

-- Trigger for updated_at in quotes_servicios_items
CREATE OR REPLACE FUNCTION update_quotes_servicios_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quotes_servicios_items_updated_at_trigger
BEFORE UPDATE ON quotes_servicios_items
FOR EACH ROW EXECUTE FUNCTION update_quotes_servicios_items_updated_at();
