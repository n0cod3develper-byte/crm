-- Migracion 124: Agregar campo terms_and_conditions a quotes_servicios
-- Permite almacenar Terminos y Condiciones personalizados por cotizacion.
-- NULL = usar el contenido estandar (fallback en el PDF).

ALTER TABLE quotes_servicios 
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
