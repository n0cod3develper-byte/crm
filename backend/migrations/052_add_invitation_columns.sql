-- Migración 052: Agregar columnas de invitación y unificar tabla users
-- Agrega columnas nombre, apellido, estado que el código auth espera
-- en la tabla users (antes solo existían en usuarios_crm)

-- Agregar columnas faltantes a la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS apellido VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'ACTIVO'
  CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires TIMESTAMPTZ;

-- Migrar datos de full_name a nombre/apellido si existen datos
UPDATE users
SET nombre = split_part(full_name, ' ', 1),
    apellido = CASE
      WHEN position(' ' in full_name) > 0
      THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE NULL
    END
WHERE full_name IS NOT NULL AND nombre IS NULL;

-- Migrar is_active a estado
UPDATE users
SET estado = CASE WHEN is_active = TRUE THEN 'ACTIVO' ELSE 'INACTIVO' END
WHERE estado IS NULL;
