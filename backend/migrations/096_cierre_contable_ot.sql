-- ============================================================
-- Migración 096: Cierre Contable Mensual (Cortes) de OTs Continuas
-- Fecha: 2026-07-30
-- ============================================================

-- 1. Agregar created_at a ot_repuestos_insumos
ALTER TABLE ot_repuestos_insumos 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Modificar constraint de estado en ordenes_trabajo para permitir LIQUIDADA_CORTE y FACTURADA
-- Primero eliminar el constraint antiguo si existe
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_check;

-- Volver a crear el constraint con los estados correctos
ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_estado_check 
  CHECK (estado IN ('ABIERTA', 'EN_PROCESO', 'LIQUIDADA', 'CERRADA', 'LIQUIDADA_CORTE', 'FACTURADA'));

-- 3. Agregar columnas para control de servicio continuo y trazabilidad de cadena
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS es_servicio_continuo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS orden_origen_id UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cadena_servicio_id UUID;

-- 4. Crear tabla maestra para lotes de corte contable
CREATE TABLE IF NOT EXISTS ot_cortes_contables (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo          VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM'
  fecha_corte      DATE NOT NULL,
  estado           VARCHAR(20) NOT NULL DEFAULT 'PROPUESTO'
                     CHECK (estado IN ('PROPUESTO', 'CONFIRMADO', 'EJECUTADO', 'CANCELADO')),
  propuesto_at     TIMESTAMPTZ DEFAULT NOW(),
  confirmado_at    TIMESTAMPTZ,
  confirmado_por   UUID REFERENCES users(id) ON DELETE SET NULL,
  ejecutado_at     TIMESTAMPTZ,
  ejecutado_por    UUID REFERENCES users(id) ON DELETE SET NULL,
  total_ots        INTEGER NOT NULL DEFAULT 0,
  notas            TEXT,
  UNIQUE(periodo)
);

-- 5. Crear tabla para items detallados de cada corte contable
CREATE TABLE IF NOT EXISTS ot_corte_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id           UUID NOT NULL REFERENCES ot_cortes_contables(id) ON DELETE CASCADE,
  orden_trabajo_id   UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,
  consecutivo_ot     VARCHAR(20) NOT NULL,
  empresa_nombre     VARCHAR(255),
  equipo_resumen     VARCHAR(255),
  monto_mano_obra    DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_repuestos    DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_mo_adicional DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
  nueva_ot_id        UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  error_mensaje      TEXT
);

-- Indices de optimización
CREATE INDEX IF NOT EXISTS idx_ot_corte_items_corte ON ot_corte_items(corte_id);
CREATE INDEX IF NOT EXISTS idx_ot_corte_items_ot ON ot_corte_items(orden_trabajo_id);
CREATE INDEX IF NOT EXISTS idx_ot_cadena_servicio ON ordenes_trabajo(cadena_servicio_id);
CREATE INDEX IF NOT EXISTS idx_ot_servicio_continuo ON ordenes_trabajo(es_servicio_continuo) WHERE es_servicio_continuo = TRUE;
