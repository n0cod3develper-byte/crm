-- Migración 053: Permitir full_name NULL (ahora usamos nombre/apellido)
ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL;
