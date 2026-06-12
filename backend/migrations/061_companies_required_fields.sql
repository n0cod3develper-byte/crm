-- ============================================================
-- Migración 061: Campos Obligatorios en Empresas (Companies)
-- ============================================================

-- 1. Limpieza de datos nulos existentes para evitar fallos de restricción
UPDATE companies 
SET nit = 'TEMP_' || SUBSTRING(id::text, 1, 8) 
WHERE nit IS NULL OR nit = '';

UPDATE companies 
SET address = 'Sin dirección' 
WHERE address IS NULL OR address = '';

UPDATE companies 
SET regimen = 'RC' 
WHERE regimen IS NULL OR regimen = '';

-- 2. Modificación de columnas a NOT NULL y establecer valores por defecto
ALTER TABLE companies ALTER COLUMN nit SET NOT NULL;
ALTER TABLE companies ALTER COLUMN address SET NOT NULL;
ALTER TABLE companies ALTER COLUMN regimen SET DEFAULT 'RC';
ALTER TABLE companies ALTER COLUMN regimen SET NOT NULL;
