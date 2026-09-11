-- Migración 129: Índices para búsqueda global
-- Fecha: 2026-09-09

BEGIN;

-- Extensión pg_trgm ya existe (migración 005)

-- Índices GIN + pg_trgm para búsqueda fuzzy
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm 
  ON companies USING GIN (name gin_trgm_ops) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventario_nombre_comercial_trgm 
  ON inventario USING GIN (nombre_comercial gin_trgm_ops);

-- Índices btree para búsqueda exacta/prefijo
CREATE INDEX IF NOT EXISTS idx_companies_nit 
  ON companies (nit) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ot_consecutivo_search 
  ON ordenes_trabajo (consecutivo) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventario_ref_fabricante 
  ON inventario (referencia_fabricante) 
  WHERE referencia_fabricante IS NOT NULL;

COMMIT;
