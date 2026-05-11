-- ============================================================
-- Migración 015: Campos adicionales en Remisiones + consecutivo catálogo
-- ============================================================

-- Nuevos campos en remisiones
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS hora_acordada  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forma_pago     VARCHAR(30) DEFAULT 'Contado'
    CHECK (forma_pago IN ('Credito', 'Contado'));

-- Serie para código automático del catálogo de servicios
INSERT INTO consecutivos (id, ultimo_valor) VALUES ('SRV', 0) ON CONFLICT DO NOTHING;
