-- ============================================================
-- Migracion 044: Columnas faltantes para activos de sistemas
-- Agrega proveedor, responsable_id, estado_activo
-- ============================================================

BEGIN;

ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS proveedor VARCHAR(200),
  ADD COLUMN IF NOT EXISTS responsable_id UUID,
  ADD COLUMN IF NOT EXISTS estado_activo VARCHAR(20)
    CHECK (estado_activo IS NULL OR estado_activo IN (
      'DISPONIBLE', 'ASIGNADO', 'EN_MANTENIMIENTO', 'DE_BAJA', 'EN_STOCK'
    ));

CREATE INDEX IF NOT EXISTS idx_inventario_responsable ON inventario (responsable_id);
CREATE INDEX IF NOT EXISTS idx_inventario_estado_activo ON inventario (estado_activo);

COMMIT;
