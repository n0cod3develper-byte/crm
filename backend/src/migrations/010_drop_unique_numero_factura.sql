-- Migración 010: Eliminar constraint UNIQUE en numero_factura
-- Permite que el mismo número de factura se use en múltiples remisiones/facturas
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_numero_factura_key;
