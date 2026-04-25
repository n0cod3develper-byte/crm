-- Migración 010: Agregar password_hash a la tabla de usuarios
-- Fecha: 2026-04-24

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
