-- ============================================================
-- Migración 035: Integración Servicios → Facturación
-- Permite convertir remisiones liquidas en facturas,
-- replicando el flujo existente de Mantenimiento.
-- ============================================================

BEGIN;

-- 1. Agregar factura_id y fecha_facturada a remisiones
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_facturada TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_remisiones_estado_factura
  ON remisiones(estado, factura_id)
  WHERE estado IN ('LIQUIDADA', 'FACTURADA');

-- 2. Tabla: factura_remisiones (análoga a factura_ots)
CREATE TABLE IF NOT EXISTS factura_remisiones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE RESTRICT,
  remision_id     UUID NOT NULL UNIQUE REFERENCES remisiones(id),
  remision_numero VARCHAR(20) NOT NULL,
  subtotal_rem    DECIMAL(14,2) NOT NULL DEFAULT 0,
  iva_rem         DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_rem       DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factura_remisiones_factura ON factura_remisiones(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_remisiones_rem     ON factura_remisiones(remision_id);

-- 3. Vista: remisiones_pendientes_facturar
CREATE OR REPLACE VIEW remisiones_pendientes_facturar AS
SELECT
  r.id,
  r.numero_remision AS consecutivo,
  r.company_id AS empresa_id,
  c.name AS empresa_nombre,
  c.nit AS empresa_nit,
  r.created_at AS fecha_creacion,
  r.updated_at AS fecha_liquidacion,
  r.total_bruto AS subtotal,
  r.iva_valor,
  r.total_neto AS total,
  r.forma_pago AS condicion_pago,
  EXTRACT(DAY FROM NOW() - r.updated_at)::int AS dias_desde_liquidacion,
  r.factura_id
FROM remisiones r
JOIN companies c ON c.id = r.company_id
WHERE r.estado = 'LIQUIDADA'
  AND r.factura_id IS NULL
  AND r.deleted_at IS NULL;

-- 4. Actualizar vista resumen_cartera_por_empresa para incluir remisiones
CREATE OR REPLACE VIEW resumen_cartera_por_empresa AS
WITH ots_data AS (
  SELECT
    e.id AS empresa_id,
    e.name,
    e.nit,
    COUNT(CASE WHEN ot.estado = 'LIQUIDADA'  THEN 1 END) AS ots_por_facturar,
    COUNT(CASE WHEN ot.estado = 'FACTURADA'  THEN 1 END) AS ots_facturadas,
    SUM(CASE WHEN ot.estado = 'LIQUIDADA'
      THEN liq.total_final ELSE 0 END)  AS valor_pendiente_facturar,
    SUM(CASE WHEN ot.estado = 'FACTURADA'
      THEN liq.total_final ELSE 0 END)  AS valor_facturado_total,
    MAX(liq.fecha_liquidacion)          AS ultima_liquidacion
  FROM companies e
  JOIN ordenes_trabajo ot  ON ot.empresa_id = e.id
  JOIN ot_liquidacion  liq ON liq.orden_trabajo_id = ot.id
  WHERE ot.estado IN ('LIQUIDADA','FACTURADA')
  GROUP BY e.id, e.name, e.nit
),
remisiones_data AS (
  SELECT
    e.id AS empresa_id,
    e.name,
    e.nit,
    COUNT(CASE WHEN r.estado = 'LIQUIDADA'  THEN 1 END) AS rem_por_facturar,
    COUNT(CASE WHEN r.estado = 'FACTURADA'  THEN 1 END) AS rem_facturadas,
    SUM(CASE WHEN r.estado = 'LIQUIDADA'
      THEN r.total_neto ELSE 0 END)  AS rem_valor_pendiente,
    SUM(CASE WHEN r.estado = 'FACTURADA'
      THEN r.total_neto ELSE 0 END)  AS rem_valor_facturado,
    MAX(r.updated_at) AS ultima_liquidacion
  FROM companies e
  JOIN remisiones r ON r.company_id = e.id
  WHERE r.estado IN ('LIQUIDADA','FACTURADA')
    AND r.deleted_at IS NULL
  GROUP BY e.id, e.name, e.nit
)
SELECT
  COALESCE(o.empresa_id, r.empresa_id) AS empresa_id,
  COALESCE(o.name, r.name) AS name,
  COALESCE(o.nit, r.nit) AS nit,
  COALESCE(o.ots_por_facturar, 0) + COALESCE(r.rem_por_facturar, 0) AS ots_por_facturar,
  COALESCE(o.ots_facturadas, 0) + COALESCE(r.rem_facturadas, 0) AS ots_facturadas,
  COALESCE(o.valor_pendiente_facturar, 0) + COALESCE(r.rem_valor_pendiente, 0) AS valor_pendiente_facturar,
  COALESCE(o.valor_facturado_total, 0) + COALESCE(r.rem_valor_facturado, 0) AS valor_facturado_total,
  GREATEST(o.ultima_liquidacion, r.ultima_liquidacion) AS ultima_liquidacion
FROM ots_data o
FULL JOIN remisiones_data r ON r.empresa_id = o.empresa_id;

COMMIT;
