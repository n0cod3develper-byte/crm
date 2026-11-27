-- ============================================================
-- Migración 146: Nuevos campos para el módulo de empleados
-- Tipo: ADITIVA (solo ADD COLUMN, nunca destructiva)
-- Compatibilidad: Todas las columnas aceptan NULL → no afecta empleados históricos
-- ============================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_vinculacion VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sede VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS grado_escolaridad VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS composicion_familiar VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS raza VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS estrato VARCHAR(5);
