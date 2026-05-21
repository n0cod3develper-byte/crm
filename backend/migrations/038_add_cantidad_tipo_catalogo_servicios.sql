-- ============================================================
-- Migraci├│n 038: Agregar columnas faltantes a catalogo_servicios
-- cantidad y tipo se referencian en el repositorio pero nunca
-- se agregaron a la tabla.
-- ============================================================

BEGIN;

ALTER TABLE catalogo_servicios
  ADD COLUMN IF NOT EXISTS cantidad INT NOT NULL DEFAULT 1;

ALTER TABLE catalogo_servicios
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) NOT NULL DEFAULT 'Servicio';

COMMIT;
