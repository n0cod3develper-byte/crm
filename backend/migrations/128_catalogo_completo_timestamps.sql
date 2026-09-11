-- MIGRACIÓN 128: Incluir created_at y updated_at en catalogo_completo para reportes por rango de fechas
BEGIN;

DROP VIEW IF EXISTS catalogo_completo CASCADE;

CREATE VIEW catalogo_completo AS
SELECT
  i.id,
  i.tipo,
  i.codigo_interno,
  i.name AS nombre_interno,
  i.nombre_comercial,
  i.sku AS referencia_sistema,
  i.referencia_fabricante,
  i.marca,
  i.area,
  c.nombre AS categoria_nombre,
  c.color_hex AS categoria_color,
  c.id AS categoria_id,
  u.abreviatura AS unidad_medida,
  u.id AS unidad_medida_id,
  i.stock_actual,
  i.stock_minimum AS stock_minimo,

  -- Clasificación técnica
  i.tipo_repuesto,
  i.referencia_cruzada,
  i.equipos_compatibles,
  i.search_vector,

  -- Ubicación
  ub.id AS ubicacion_id,
  ub.codigo_ubicacion,

  -- Precios unificados
  CASE
    WHEN i.tipo = 'PRODUCTO' THEN i.unit_price
    ELSE i.precio_servicio
  END AS precio_venta,
  CASE
    WHEN i.tipo = 'PRODUCTO' THEN i.costo_reposicion
    ELSE i.precio_servicio_minimo
  END AS costo_o_minimo,

  i.aplica_iva,
  i.iva_pct,
  i.is_active,
  i.activo_catalogo,
  i.imagen_url,
  i.imagen_thumb_url,
  i.descripcion_corta,
  i.descripcion_larga,
  i.created_at,
  i.updated_at
FROM inventario i
LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
LEFT JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id;

-- Índice para acelerar filtros de reportes por fecha de creación
CREATE INDEX IF NOT EXISTS idx_inventario_created_at ON inventario (created_at);

COMMIT;
