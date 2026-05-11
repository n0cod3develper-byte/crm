BEGIN;

DROP VIEW IF EXISTS catalogo_completo CASCADE;

-- Actualizar la vista catalogo_completo para incluir la columna marca y asegurar integridad de datos
CREATE OR REPLACE VIEW catalogo_completo AS
SELECT
  i.id,
  i.tipo,
  i.codigo_interno,
  i.name AS nombre_interno,
  i.nombre_comercial,
  i.sku AS referencia_sistema,
  i.referencia_fabricante,
  i.marca, -- Columna agregada recientemente
  c.nombre AS categoria_nombre,
  c.color_hex AS categoria_color,
  c.id AS categoria_id,
  u.abreviatura AS unidad_medida,
  u.id AS unidad_medida_id,
  i.stock_current AS stock_actual,
  i.stock_minimum AS stock_minimo,
  -- Ubicación
  ub.id AS ubicacion_id,
  ub.codigo_ubicacion,
  ub.bodega as bodega_nombre,
  -- Precios unificados
  CASE 
    WHEN i.tipo = 'PRODUCTO' THEN i.unit_price 
    ELSE i.precio_servicio 
  END AS precio_venta,
  CASE 
    WHEN i.tipo = 'PRODUCTO' THEN i.unit_cost 
    ELSE i.precio_servicio_minimo 
  END AS costo_o_minimo,
  i.aplica_iva,
  i.iva_pct,
  i.is_active,
  i.activo_catalogo,
  i.imagen_thumb_url,
  i.descripcion_corta,
  i.descripcion_larga
FROM inventory_items i
LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
LEFT JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id;

COMMIT;
