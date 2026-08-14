-- Migración para corregir tabla quotes_servicios_items
ALTER TABLE quotes_servicios_items ADD COLUMN IF NOT EXISTS catalogo_servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL;
