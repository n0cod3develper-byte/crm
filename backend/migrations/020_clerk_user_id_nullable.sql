-- Migración: Hacer clerk_user_id nullable
-- Razón: El sistema ya no usa Clerk para autenticación.
--         Se usa autenticación propia (JWT + bcrypt).
--         La columna clerk_user_id se mantiene por compatibilidad pero ya no es requerida.

ALTER TABLE usuarios_crm ALTER COLUMN clerk_user_id DROP NOT NULL;
