-- Migración: Hacer clerk_user_id nullable
-- Razón: El sistema ya no usa Clerk para autenticación.
--         Se usa autenticación propia (JWT + bcrypt).
--         La columna clerk_user_id ya no existe en la tabla users,
--         por lo que esta migración es un no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE users ALTER COLUMN clerk_user_id DROP NOT NULL;
  END IF;
END $$;
