-- Agrega columna phone_2 a companies para teléfono secundario
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS phone_2 VARCHAR(30);

COMMENT ON COLUMN companies.phone_2 IS 'Teléfono secundario de la empresa';
