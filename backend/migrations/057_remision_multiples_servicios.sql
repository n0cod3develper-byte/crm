-- ============================================================
-- Migración 057: Permitir múltiples ítems de servicio por remisión y simplificar recargos
-- ============================================================

-- 1. Crear tabla detalle de servicios por remisión
CREATE TABLE IF NOT EXISTS remision_servicios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id           UUID NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  catalogo_servicio_id  UUID NOT NULL REFERENCES catalogo_servicios(id) ON DELETE RESTRICT,
  descripcion           TEXT,
  cantidad              DECIMAL(10,2) DEFAULT 1,
  valor_unitario        DECIMAL(12,2) DEFAULT 0,
  subtotal              DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * valor_unitario) STORED,
  orden                 INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para la tabla detalle
CREATE INDEX IF NOT EXISTS idx_remision_servicios_remision_id ON remision_servicios(remision_id);
CREATE INDEX IF NOT EXISTS idx_remision_servicios_catalogo_id ON remision_servicios(catalogo_servicio_id);

-- 2. Añadir nuevas columnas simplificadas de recargo a remisiones
ALTER TABLE remisiones 
  ADD COLUMN IF NOT EXISTS horas_ordinarias DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_hora_ordinaria DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_recargo DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_hora_recargo DECIMAL(12,2) DEFAULT 0;

-- 3. Migrar los datos existentes
INSERT INTO remision_servicios (remision_id, catalogo_servicio_id, cantidad, valor_unitario)
SELECT 
  id as remision_id, 
  catalogo_servicio_id, 
  COALESCE(NULLIF(cantidad_horas, 0), 1) as cantidad, 
  valor_hora as valor_unitario
FROM remisiones
WHERE catalogo_servicio_id IS NOT NULL;

-- 4. Quitar restricción NOT NULL de catalogo_servicio_id en remisiones
ALTER TABLE remisiones ALTER COLUMN catalogo_servicio_id DROP NOT NULL;
