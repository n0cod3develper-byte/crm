-- ============================================================
-- Migración 095: Ítems adicionales de Mano de Obra en OT
-- Permite agregar conceptos de venta (ej. traslados, urgencias)
-- que se suman al total_mano_obra calculado por horas × tarifa.
-- ============================================================

CREATE TABLE IF NOT EXISTS ot_mano_obra_adicional (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  precio           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ot_mo_adicional_ot
  ON ot_mano_obra_adicional(orden_trabajo_id);
