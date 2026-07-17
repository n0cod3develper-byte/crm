-- Migration 081: Corregir FK de autorizado_por en quote_items
-- El campo autorizado_por puede tener una FK apuntando a users(id) en lugar de employees(id).
-- Este script detecta y elimina la constraint incorrecta, luego la recrea apuntando a employees(id).

BEGIN;

-- 1. Eliminar cualquier constraint existente de autorizado_por en quote_items
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'quote_items'::regclass
      AND contype = 'f'
      AND conname ILIKE '%autorizado%'
  LOOP
    EXECUTE format('ALTER TABLE quote_items DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END;
$$;

-- 2. Asegurarse de que la columna existe (por si la migración 080 no corrió)
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS autorizado_por UUID;

-- 3. Limpiar valores que no existen en employees para evitar violación de FK
UPDATE quote_items
SET autorizado_por = NULL
WHERE autorizado_por IS NOT NULL
  AND autorizado_por NOT IN (SELECT id FROM employees);

-- 4. Agregar la constraint correcta apuntando a employees(id)
ALTER TABLE quote_items
  ADD CONSTRAINT quote_items_autorizado_por_fkey
  FOREIGN KEY (autorizado_por) REFERENCES employees(id) ON DELETE SET NULL;

-- 5. Asegurarse de que los demás campos extendidos existen
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS origen               VARCHAR(20) DEFAULT 'inventario'
    CHECK (origen IN ('inventario', 'proveedor')),
  ADD COLUMN IF NOT EXISTS inventario_id        UUID REFERENCES inventario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proveedor_id         UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS costo_base           NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_incremento NUMERIC(5,2) DEFAULT 23,
  ADD COLUMN IF NOT EXISTS justificacion_descuento TEXT;

-- 6. Asegurarse de que existe la tabla de reservas soft
CREATE TABLE IF NOT EXISTS inventario_reservas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id     UUID NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  quote_id          UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_item_id     UUID REFERENCES quote_items(id) ON DELETE SET NULL,
  cantidad_reservada NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado            VARCHAR(20) DEFAULT 'activa'
    CHECK (estado IN ('activa', 'liberada', 'consumida')),
  creado_en         TIMESTAMPTZ DEFAULT NOW(),
  expira_en         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventario_reservas_inventario ON inventario_reservas(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_reservas_quote      ON inventario_reservas(quote_id);
CREATE INDEX IF NOT EXISTS idx_inventario_reservas_estado     ON inventario_reservas(estado);

COMMIT;
