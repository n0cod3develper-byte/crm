-- ============================================================
-- Migración 012: Agregar campos teléfono 2 y departamento a Empresas
-- ============================================================

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS phone_2 VARCHAR(30),
ADD COLUMN IF NOT EXISTS department VARCHAR(100);
