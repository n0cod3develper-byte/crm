-- Migración 131: Agregar cliente, proveedor y N° OT a la vista de historial de movimientos
-- Se agregan LEFT JOINs a ordenes_trabajo, companies (via OT y quotes)

BEGIN;

DROP VIEW IF EXISTS historial_movimientos_completo;

CREATE VIEW historial_movimientos_completo AS
SELECT
  m.id,
  m.tipo_movimiento,
  m.tipo_documento,
  m.numero_documento,
  m.fecha_documento,
  i.id              AS producto_id,
  i.codigo_interno  AS producto_codigo,
  i.name            AS producto_nombre,
  i.nombre_comercial,
  c.nombre          AS familia_nombre,
  u.abreviatura     AS unidad,
  m.cantidad,
  m.precio_unitario,
  m.subtotal,
  m.iva_pct,
  m.iva_valor,
  m.total_con_iva,
  m.stock_antes,
  m.stock_despues,
  m.costo_promedio_antes,
  m.costo_promedio_despues,
  m.proveedor_id,
  COALESCE(m.proveedor_nombre, p.razon_social) AS proveedor,
  m.oc_id,
  m.ot_id,
  CASE m.tipo_movimiento
    WHEN 'ENTRADA_COMPRA'     THEN 'Compra directa'
    WHEN 'ENTRADA_OC'         THEN 'Recepción OC'
    WHEN 'ENTRADA_DEVOLUCION' THEN 'Devolución entrada'
    WHEN 'ENTRADA_AJUSTE'     THEN 'Ajuste positivo'
    WHEN 'SALIDA_OT'          THEN 'Consumo en OT'
    WHEN 'SALIDA_AJUSTE'      THEN 'Ajuste negativo'
    WHEN 'SALIDA_DEVOLUCION'  THEN 'Devolución a proveedor'
    WHEN 'TRASLADO_ENTRADA'   THEN 'Traslado entrada'
    WHEN 'TRASLADO_SALIDA'    THEN 'Traslado salida'
  END AS tipo_label,
  CASE
    WHEN m.tipo_movimiento LIKE 'ENTRADA%'  THEN '+'
    WHEN m.tipo_movimiento LIKE 'SALIDA%'   THEN '-'
    WHEN m.tipo_movimiento = 'TRASLADO_ENTRADA' THEN '+'
    WHEN m.tipo_movimiento = 'TRASLADO_SALIDA'  THEN '-'
  END AS signo,
  m.notas,
  m.registrado_por,
  m.created_at,
  -- Nuevos campos: N° OT y Cliente
  COALESCE(ot.consecutivo, CASE WHEN m.numero_documento LIKE 'OT-%' THEN m.numero_documento ELSE NULL END) AS numero_ot,
  COALESCE(comp_ot.name, comp_q.name) AS cliente
FROM movimientos_inventario   m
JOIN inventario               i ON i.id = m.inventario_id
LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
LEFT JOIN unidades_medida     u ON u.id = i.unidad_medida_id
LEFT JOIN proveedores         p ON p.id = m.proveedor_id
LEFT JOIN ordenes_trabajo    ot ON ot.id = m.ot_id
LEFT JOIN companies      comp_ot ON comp_ot.id = ot.empresa_id
LEFT JOIN quotes              q ON q.quote_number = m.numero_documento
LEFT JOIN companies      comp_q ON comp_q.id = q.company_id;

COMMIT;
