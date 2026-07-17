-- Migration 080: Campos extendidos en quote_items y tabla inventario_reservas
-- Estos campos soportan el módulo de cotizaciones cliente con origen, markup y autorización.

BEGIN;

-- 1. Añadir columnas faltantes en quote_items
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS origen               VARCHAR(20) DEFAULT 'inventario'
    CHECK (origen IN ('inventario', 'proveedor')),
  ADD COLUMN IF NOT EXISTS inventario_id        UUID REFERENCES inventario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proveedor_id         UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS costo_base           NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_incremento NUMERIC(5,2) DEFAULT 23,
  ADD COLUMN IF NOT EXISTS autorizado_por       UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificacion_descuento TEXT;

-- 2. Crear tabla de reservas soft de inventario para cotizaciones cliente
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
