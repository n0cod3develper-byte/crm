-- MIGRACIÓN 013: Ampliación de inventory_items a Catálogo Unificado (Productos + Servicios)
-- Basado en requerimientos PRO para CRM CARGAR

BEGIN;

-- 1. Crear tabla de Unidades de Medida si no existe
CREATE TABLE IF NOT EXISTS unidades_medida (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(50) UNIQUE NOT NULL,
  abreviatura VARCHAR(10) UNIQUE NOT NULL,
  tipo        VARCHAR(20) NOT NULL
    CHECK (tipo IN ('VOLUMEN','PESO','LONGITUD','UNIDAD','TIEMPO','AREA')),
  activo      BOOLEAN DEFAULT TRUE,
  orden       INT DEFAULT 0
);

-- Seeds para unidades comunes
INSERT INTO unidades_medida (nombre, abreviatura, tipo, orden) VALUES
  ('Litro',        'L',    'VOLUMEN',  1),
  ('Galón',        'Gal',  'VOLUMEN',  2),
  ('Kilogramo',    'Kg',   'PESO',     4),
  ('Unidad',       'Und',  'UNIDAD',   7),
  ('Hora',         'Hr',   'TIEMPO',   11),
  ('Visita',       'Vis',  'TIEMPO',   13),
  ('Metro',        'm',    'LONGITUD', 14)
ON CONFLICT (nombre) DO NOTHING;

-- 2. Crear tabla de Categorías del Catálogo (Evolución de la categoría simple)
CREATE TABLE IF NOT EXISTS catalogo_categorias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(100) UNIQUE NOT NULL,
  slug                VARCHAR(80)  UNIQUE NOT NULL,
  descripcion         TEXT,
  tipo_aplicable      VARCHAR(20) DEFAULT 'AMBOS'
    CHECK (tipo_aplicable IN ('PRODUCTO','SERVICIO','AMBOS')),
  color_hex           VARCHAR(7),
  icono               VARCHAR(50),
  margen_minimo_pct   DECIMAL(5,2) DEFAULT 20.00,
  margen_objetivo_pct DECIMAL(5,2) DEFAULT 35.00,
  orden               INT DEFAULT 0,
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- Seeds iniciales para categorías
INSERT INTO catalogo_categorias
  (nombre, slug, tipo_aplicable, color_hex, icono, margen_minimo_pct, margen_objetivo_pct, orden)
VALUES
  ('Lubricantes y Aceites',  'lubricantes',   'PRODUCTO', '#EAB308', 'Droplets',    20, 35, 1),
  ('Filtros',                'filtros',        'PRODUCTO', '#3B82F6', 'Filter',      25, 40, 2),
  ('Mano de Obra',           'mano_obra',      'SERVICIO', '#2563EB', 'Wrench',       0,  0, 8),
  ('Visitas Técnicas',       'visitas',        'SERVICIO', '#7C3AED', 'MapPin',       0,  0, 9),
  ('Consumibles Generales',  'consumibles',    'PRODUCTO', '#6B7280', 'Package',     20, 35, 7)
ON CONFLICT (slug) DO NOTHING;

-- 3. Ampliar tabla inventory_items
ALTER TABLE inventory_items
  -- Clasificación
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'PRODUCTO'
    CHECK (tipo IN ('PRODUCTO', 'SERVICIO')),

  -- Identificación
  ADD COLUMN IF NOT EXISTS codigo_interno VARCHAR(50),
  ADD COLUMN IF NOT EXISTS codigo_barras  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS referencia_fabricante VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(255),

  -- Descripciones
  ADD COLUMN IF NOT EXISTS descripcion_corta VARCHAR(500),
  ADD COLUMN IF NOT EXISTS descripcion_larga TEXT,
  ADD COLUMN IF NOT EXISTS especificaciones  JSONB DEFAULT '{}'::jsonb,

  -- Relaciones
  ADD COLUMN IF NOT EXISTS unidad_medida_id UUID REFERENCES unidades_medida(id),
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES catalogo_categorias(id),

  -- Multimedia
  ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS imagen_thumb_url VARCHAR(500),

  -- Control de stock (Productos)
  ADD COLUMN IF NOT EXISTS stock_maximo   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS ubicacion_bodega VARCHAR(100),

  -- Precios Servicio (Servicios)
  ADD COLUMN IF NOT EXISTS unidad_cobro VARCHAR(50),
  ADD COLUMN IF NOT EXISTS precio_servicio DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS precio_servicio_minimo DECIMAL(14,2),

  -- Visibilidad y Estado
  ADD COLUMN IF NOT EXISTS activo_catalogo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS activo_compras  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS es_destacado    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proveedor_preferido_id UUID REFERENCES proveedores(id),

  -- Impuestos
  ADD COLUMN IF NOT EXISTS aplica_iva   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS iva_pct      DECIMAL(5,2) DEFAULT 19.00,

  -- Auditoría
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

-- 4. Migración de datos existentes
-- 4.1 Asignar tipo PRODUCTO
UPDATE inventory_items SET tipo = 'PRODUCTO' WHERE tipo IS NULL;

-- 4.2 Poblar nombre_comercial
UPDATE inventory_items SET nombre_comercial = name WHERE nombre_comercial IS NULL;

-- 4.3 Generar códigos internos para existentes (PRD-00001...)
-- Usamos una subconsulta para asignar números secuenciales
DO $$
DECLARE
    rec RECORD;
    i INT := 1;
BEGIN
    FOR rec IN SELECT id FROM inventory_items WHERE codigo_interno IS NULL ORDER BY created_at LOOP
        UPDATE inventory_items SET codigo_interno = 'PRD-' || LPAD(i::TEXT, 5, '0') WHERE id = rec.id;
        i := i + 1;
    END LOOP;
END $$;

-- 4.4 Vincular categorías existentes (si el nombre coincide con los nuevos slugs/nombres)
UPDATE inventory_items i
SET categoria_id = c.id
FROM catalogo_categorias c
WHERE i.category = c.nombre OR i.category = c.slug;

-- 5. Crear Secuencias para nuevos códigos
CREATE SEQUENCE IF NOT EXISTS seq_codigo_producto START 100; -- Empezar en 100 para no chocar con los migrados
CREATE SEQUENCE IF NOT EXISTS seq_codigo_servicio START 1;

-- 6. Crear Índices
CREATE INDEX IF NOT EXISTS idx_inventory_tipo ON inventory_items(tipo);
CREATE INDEX IF NOT EXISTS idx_inventory_codigo_int ON inventory_items(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_inventory_activo_cat ON inventory_items(activo_catalogo) WHERE activo_catalogo = TRUE;

-- 7. Crear Vista Unificada
CREATE OR REPLACE VIEW catalogo_completo AS
SELECT
  i.id,
  i.tipo,
  i.codigo_interno,
  i.name AS nombre_interno,
  i.nombre_comercial,
  i.sku AS referencia_sistema, -- SKU original se mantiene para compatibilidad
  i.referencia_fabricante,
  c.nombre AS categoria_nombre,
  c.color_hex AS categoria_color,
  u.abreviatura AS unidad_medida,
  i.stock_current AS stock_actual,
  i.stock_minimum AS stock_minimo,
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
  i.imagen_thumb_url
FROM inventory_items i
LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id;

-- 8. Seeds de servicios iniciales
INSERT INTO inventory_items (
  tipo, codigo_interno, name, nombre_comercial, descripcion_corta, 
  categoria_id, unidad_cobro, precio_servicio, precio_servicio_minimo, 
  aplica_iva, iva_pct, activo_catalogo, activo_compras
) VALUES
  (
    'SERVICIO', 'SRV-00001',
    'Mano de Obra Técnico',
    'Mano de Obra Técnico Especializado',
    'Hora de trabajo de técnico certificado en mantenimiento de montacargas',
    (SELECT id FROM catalogo_categorias WHERE slug = 'mano_obra'),
    'hora', 85000, 70000, TRUE, 19, TRUE, FALSE
  ),
  (
    'SERVICIO', 'SRV-00002',
    'Visita Técnica',
    'Visita Técnica a Instalaciones del Cliente',
    'Desplazamiento y atención técnica en sitio del cliente',
    (SELECT id FROM catalogo_categorias WHERE slug = 'visitas'),
    'visita', 120000, 100000, TRUE, 19, TRUE, FALSE
  )
ON CONFLICT DO NOTHING;

COMMIT;
