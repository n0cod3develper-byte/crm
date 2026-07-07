-- MIGRACIÓN 071: Relación muchos-a-muchos entre Centros de Costos e Inventario (Insumos/Servicios)

BEGIN;

CREATE TABLE IF NOT EXISTS centro_costo_items (
  centro_costo_id UUID NOT NULL REFERENCES centros_costos(id) ON DELETE CASCADE,
  inventario_id UUID NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (centro_costo_id, inventario_id)
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_cci_centro_costo ON centro_costo_items(centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_cci_inventario ON centro_costo_items(inventario_id);

COMMIT;
