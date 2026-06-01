-- ============================================================
-- Migración 042: Áreas de Inventario (Mantenimiento, Locativo, Sistemas, SST)
-- Fecha: 2026-05-28
-- ============================================================

BEGIN;

-- 1. Agregar columna area a inventario
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT 'MANTENIMIENTO';

-- 2. Crear categorías para las nuevas áreas
INSERT INTO catalogo_categorias (nombre, slug, tipo_aplicable, color_hex, icono, margen_minimo_pct, margen_objetivo_pct, orden)
VALUES
  -- Área LOCATIVO
  ('Muebles y Enseres',       'muebles-enseres',       'PRODUCTO', '#F97316', 'Sofa',        20, 35, 20),
  ('Aires Acondicionados',    'aires-acondicionados',  'PRODUCTO', '#0EA5E9', 'Wind',        20, 35, 21),
  ('Equipos de Oficina',      'equipos-oficina',       'PRODUCTO', '#8B5CF6', 'Printer',     20, 35, 22),
  ('Extintores y Seguridad',  'extintores',            'PRODUCTO', '#EF4444', 'Flame',       20, 35, 23),
  ('Cocina y Cafetería',      'cocina-cafeteria',      'PRODUCTO', '#EC4899', 'Coffee',      20, 35, 24),

  -- Área SISTEMAS
  ('Equipos de Cómputo',      'equipos-computo',       'PRODUCTO', '#6366F1', 'Monitor',     20, 35, 30),
  ('Redes y Telecomunicaciones', 'redes-telecom',      'PRODUCTO', '#14B8A6', 'Wifi',        20, 35, 31),
  ('Cámaras y Vigilancia',    'camaras-vigilancia',    'PRODUCTO', '#06B6D4', 'Camera',      20, 35, 32),
  ('Servidores y UPS',        'servidores-ups',        'PRODUCTO', '#DC2626', 'Server',      20, 35, 33),
  ('Licencias y Software',    'licencias-software',    'PRODUCTO', '#A855F7', 'Cpu',         20, 35, 34),

  -- Área SST (Seguridad y Salud en el Trabajo)
  ('Botiquines y Primeros Auxilios', 'botiquines',     'PRODUCTO', '#22C55E', 'Cross',       20, 35, 40),
  ('Equipos de Protección Personal', 'epp',            'PRODUCTO', '#FACC15', 'Shield',      20, 35, 41),
  ('Señalización',             'senalizacion',          'PRODUCTO', '#F97316', 'Triangle',    20, 35, 42),
  ('Camillas y Rescate',       'camillas-rescate',      'PRODUCTO', '#DC2626', 'Stretcher',   20, 35, 43),
  ('Implementos SST',          'implementos-sst',       'PRODUCTO', '#84CC16', 'HardHat',     20, 35, 44)
ON CONFLICT (slug) DO NOTHING;

-- 3. Recrear vista catalogo_completo incluyendo area
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
  i.descripcion_larga
FROM inventario i
LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
LEFT JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id;

-- 4. Índice para filtrar por área
CREATE INDEX IF NOT EXISTS idx_inventario_area ON inventario (area);

COMMIT;
