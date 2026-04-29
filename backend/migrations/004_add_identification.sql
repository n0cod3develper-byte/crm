-- ============================================================
-- Migración 004: Agregar campo de identificación a Empleados
-- ============================================================

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS identification VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_employees_identification ON employees(identification);
