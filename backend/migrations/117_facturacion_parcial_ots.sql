-- 117_facturacion_parcial_ots.sql

BEGIN;

-- 1. Eliminar la restricción UNIQUE de factura_ots
ALTER TABLE factura_ots DROP CONSTRAINT IF EXISTS factura_ots_ot_id_key;

-- 2. Modificar el constraint de estado en ordenes_trabajo para permitir PARCIALMENTE_FACTURADA
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_check;
ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_estado_check 
  CHECK (estado IN ('ABIERTA', 'EN_PROCESO', 'LIQUIDADA', 'CERRADA', 'LIQUIDADA_CORTE', 'FACTURADA', 'PARCIALMENTE_FACTURADA', 'ANULADA'));

-- 3. Recrear la vista de ots_pendientes_facturar para calcular el saldo
DROP VIEW IF EXISTS ots_pendientes_facturar CASCADE;

CREATE OR REPLACE VIEW ots_pendientes_facturar AS
SELECT
  ot.id,
  ot.consecutivo,
  ot.tipo_mantenimiento,
  ot.estado,
  ot.empresa_id,
  e.name AS empresa_nombre,
  e.nit AS empresa_nit,
  e.condicion_pago,
  liq.fecha_liquidacion,
  (EXTRACT(day FROM (now() - liq.fecha_liquidacion)))::integer AS dias_desde_liquidacion,
  liq.subtotal AS subtotal_original,
  liq.impuesto_valor AS iva_original,
  liq.total_final AS total_original,
  -- Calcular el saldo pendiente
  (liq.total_final - COALESCE(
    (SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 
  0)) AS saldo_pendiente,
  -- Para mantener compatibilidad con consultas anteriores, sobreescribimos total
  (liq.total_final - COALESCE(
    (SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 
  0)) AS total,
  -- Subtotal e iva proporcional
  ((liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0)) / 1.19) AS subtotal,
  ((liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0)) - ((liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0)) / 1.19)) AS iva_valor
FROM ordenes_trabajo ot
JOIN companies e ON ot.empresa_id = e.id
JOIN ot_liquidacion liq ON liq.orden_trabajo_id = ot.id
WHERE ot.estado IN ('LIQUIDADA', 'PARCIALMENTE_FACTURADA')
  AND (liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0)) > 0;

COMMIT;
