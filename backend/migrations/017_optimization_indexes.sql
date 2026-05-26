BEGIN;

-- Optimización de índices para relaciones frecuentes
CREATE INDEX IF NOT EXISTS idx_inventory_categoria_id ON inventory_items(categoria_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ubicacion_id ON inventory_items(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(item_id);

COMMIT;
