-- ============================================================
-- Migración 011: Agregar campo de empresa a Empleados
-- ============================================================

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS company VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company);
