BEGIN;

ALTER TABLE proveedores 
  ADD COLUMN IF NOT EXISTS telefono_secundario VARCHAR(50),
  ADD COLUMN IF NOT EXISTS especialidad_familia UUID REFERENCES catalogo_categorias(id) ON DELETE SET NULL;

COMMIT;
