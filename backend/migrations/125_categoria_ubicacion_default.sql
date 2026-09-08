-- Migracion 125: Ubicacion por Familia (consecutivo de estanteria)
-- Vincula cada familia (catalogo_categorias) con su ubicacion fisica por defecto
-- (ubicaciones_bodega) para que la ubicacion del producto se derive de la Familia
-- al momento del registro (Alternativa B - ubicacion persistida).
-- Aditiva y segura: no modifica ni elimina datos existentes.

ALTER TABLE catalogo_categorias
ADD COLUMN IF NOT EXISTS ubicacion_default_id UUID REFERENCES ubicaciones_bodega(id);
