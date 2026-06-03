-- ============================================================
-- Migracion 045: Campos de documento y departamento para empleados
-- Agrega tipo_documento (CC, TE, TI, PASAPORTE),
-- numero_documento y departamento/area de la empresa.
-- ============================================================

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20)
    CHECK (tipo_documento IS NULL OR tipo_documento IN ('CC', 'TE', 'TI', 'PASAPORTE')),
  ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(30),
  ADD COLUMN IF NOT EXISTS departamento   VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_employees_numero_documento ON employees (numero_documento);
CREATE INDEX IF NOT EXISTS idx_employees_departamento    ON employees (departamento);

COMMIT;
