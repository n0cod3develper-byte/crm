-- ============================================================
-- Migración 116: Facturación Parcial de Remisiones
-- Eliminar restricción UNIQUE y calcular saldo pendiente
-- ============================================================

-- 1. Eliminar la restricción UNIQUE de remision_id en factura_remisiones
ALTER TABLE factura_remisiones DROP CONSTRAINT IF EXISTS factura_remisiones_remision_id_key;

-- 2. Recrear la vista de remisiones pendientes para usar el saldo en lugar de factura_id IS NULL
DROP VIEW IF EXISTS remisiones_pendientes_facturar CASCADE;
CREATE OR REPLACE VIEW remisiones_pendientes_facturar AS
SELECT
  r.id,
  r.numero_remision AS consecutivo,
  r.company_id AS empresa_id,
  c.name AS empresa_nombre,
  c.nit AS empresa_nit,
  r.created_at AS fecha_creacion,
  r.updated_at AS fecha_liquidacion,
  -- El total bruto original de la remisión
  r.total_bruto AS subtotal_original,
  r.iva_valor AS iva_original,
  r.total_neto AS total_original,
  -- Calcular cuánto se ha facturado ya de esta remisión
  COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS total_facturado,
  -- El saldo es lo que falta por facturar
  r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS total,
  -- Proporción para calcular subtotal e IVA del saldo restante
  (r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0)) / NULLIF(r.total_neto, 0) AS proporcion,
  
  -- Campos calculados para compatibilidad
  (r.total_bruto * ((r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0)) / NULLIF(r.total_neto, 0)))::numeric(14,2) AS subtotal,
  (r.iva_valor * ((r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0)) / NULLIF(r.total_neto, 0)))::numeric(14,2) AS iva_valor,
  
  r.forma_pago AS condicion_pago,
  EXTRACT(DAY FROM NOW() - r.updated_at)::int AS dias_desde_liquidacion,
  r.factura_id
FROM remisiones r
JOIN companies c ON c.id = r.company_id
WHERE r.estado IN ('LIQUIDADA', 'PARCIALMENTE_FACTURADA')
  AND r.deleted_at IS NULL
  -- Solo mostrar las que tengan un saldo pendiente mayor a cero (tolerancia de centavos)
  AND (r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0)) > 0.01;

-- 3. Actualizar constraint de estado de remisiones
ALTER TABLE remisiones DROP CONSTRAINT IF EXISTS remisiones_estado_check;
ALTER TABLE remisiones ADD CONSTRAINT remisiones_estado_check 
  CHECK (estado IN ('BORRADOR', 'ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'FINALIZADA', 'REALIZADA', 'RECHAZADA', 'LIQUIDADA', 'PARCIALMENTE_FACTURADA', 'FACTURADA', 'ANULADO'));

-- 4. Actualizar la vista resumen_cartera_por_empresa
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
    -- Contar remisiones pendientes
    COUNT(CASE WHEN r.estado IN ('LIQUIDADA', 'PARCIALMENTE_FACTURADA') THEN 1 END) AS rem_por_facturar,
    COUNT(CASE WHEN r.estado = 'FACTURADA'  THEN 1 END) AS rem_facturadas,
    -- Sumar saldo pendiente de las remisiones
    SUM(CASE WHEN r.estado IN ('LIQUIDADA', 'PARCIALMENTE_FACTURADA')
      THEN r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) ELSE 0 END)  AS rem_valor_pendiente,
    -- Sumar facturado
    SUM(COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0)) AS rem_valor_facturado,
    MAX(r.updated_at) AS ultima_liquidacion
  FROM companies e
  JOIN remisiones r ON r.company_id = e.id
  WHERE r.estado IN ('LIQUIDADA','PARCIALMENTE_FACTURADA','FACTURADA')
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
FULL OUTER JOIN remisiones_data r ON o.empresa_id = r.empresa_id;
