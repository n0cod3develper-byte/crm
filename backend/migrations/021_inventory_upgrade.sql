BEGIN;

-- 1. Tablas para jerarquía de ubicaciones
CREATE TABLE IF NOT EXISTS ubicacion_prefijos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(10) UNIQUE NOT NULL, -- ej. EST, CAJ
  descripcion VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ubicacion_niveles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(10) UNIQUE NOT NULL, -- ej. N1, N2
  descripcion VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seeds básicos de prefijos y niveles
INSERT INTO ubicacion_prefijos (codigo, descripcion) VALUES 
('EST', 'Estante Principal'),
('CAJ', 'Cajonera'),
('PIS', 'Piso / Tarima'),
('VIT', 'Vitrina'),
('SIN', 'Sin Clasificar')
ON CONFLICT DO NOTHING;

INSERT INTO ubicacion_niveles (codigo, descripcion) VALUES 
('N1', 'Nivel 1 (Base)'),
('N2', 'Nivel 2'),
('N3', 'Nivel 3'),
('N4', 'Nivel 4 (Alto)'),
('N/A', 'No Aplica')
ON CONFLICT DO NOTHING;

-- Modificar ubicaciones_bodega para usar prefijos y niveles.
ALTER TABLE ubicaciones_bodega 
  ADD COLUMN IF NOT EXISTS prefijo_id UUID REFERENCES ubicacion_prefijos(id),
  ADD COLUMN IF NOT EXISTS nivel_id UUID REFERENCES ubicacion_niveles(id),
  ADD COLUMN IF NOT EXISTS orientacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nueva_posicion VARCHAR(20);

-- Mapeo inicial básico si existen registros antiguos
UPDATE ubicaciones_bodega 
SET prefijo_id = (SELECT id FROM ubicacion_prefijos WHERE codigo = 'EST' LIMIT 1),
    nivel_id = (SELECT id FROM ubicacion_niveles WHERE codigo = 'N1' LIMIT 1),
    orientacion = 'FRENTE',
    nueva_posicion = COALESCE(posicion, '01')
WHERE prefijo_id IS NULL;

-- Cambiar el codigo_ubicacion autogenerado a un trigger o volver a autogenerar
DROP VIEW IF EXISTS catalogo_completo CASCADE;
ALTER TABLE ubicaciones_bodega DROP COLUMN codigo_ubicacion;
ALTER TABLE ubicaciones_bodega ADD COLUMN codigo_ubicacion VARCHAR(100);

-- 2. Clasificación técnica en inventario
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS tipo_repuesto VARCHAR(50) DEFAULT 'N/A',
  ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referencia_cruzada JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipos_compatibles JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Índices GIN para JSONB y TSVECTOR
CREATE INDEX IF NOT EXISTS idx_inventory_ref_cruzada ON inventario USING GIN (referencia_cruzada);
CREATE INDEX IF NOT EXISTS idx_inventory_equipos_comp ON inventario USING GIN (equipos_compatibles);
CREATE INDEX IF NOT EXISTS idx_inventory_search_vector ON inventario USING GIN (search_vector);

COMMIT;

-- Triggers no pueden estar dentro del bloque transaccional con ciertas versiones/operaciones, 
-- pero Postgres los permite en BEGIN/COMMIT. Hacemos bloque separado para funciones.
BEGIN;

CREATE OR REPLACE FUNCTION generate_ubicacion_code() RETURNS TRIGGER AS $$
DECLARE
  prefijo_cod VARCHAR(10);
  nivel_cod VARCHAR(10);
BEGIN
  SELECT codigo INTO prefijo_cod FROM ubicacion_prefijos WHERE id = NEW.prefijo_id;
  SELECT codigo INTO nivel_cod FROM ubicacion_niveles WHERE id = NEW.nivel_id;
  
  NEW.codigo_ubicacion := UPPER(
    COALESCE(prefijo_cod, 'X') || '-' ||
    COALESCE(nivel_cod, 'X') || '-' ||
    COALESCE(NEW.orientacion, 'X') || '-' ||
    COALESCE(NEW.nueva_posicion, 'X')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_ubicacion_code ON ubicaciones_bodega;
CREATE TRIGGER trg_generate_ubicacion_code
  BEFORE INSERT OR UPDATE ON ubicaciones_bodega
  FOR EACH ROW EXECUTE PROCEDURE generate_ubicacion_code();

CREATE OR REPLACE FUNCTION update_inventory_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', COALESCE(NEW.nombre_comercial, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.codigo_interno, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.referencia_fabricante, '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.marca, '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.descripcion_corta, '')), 'C') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.equipos_compatibles::text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_search_vector ON inventario;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE ON inventario
  FOR EACH ROW EXECUTE PROCEDURE update_inventory_search_vector();

COMMIT;

-- Trigger update force
UPDATE ubicaciones_bodega SET id = id;
UPDATE inventario SET id = id;

BEGIN;
-- Insertar ubicacion generica si no existe y migrar (Parte 6)
INSERT INTO ubicaciones_bodega (prefijo_id, nivel_id, orientacion, nueva_posicion, descripcion) 
SELECT 
  (SELECT id FROM ubicacion_prefijos WHERE codigo = 'SIN'),
  (SELECT id FROM ubicacion_niveles WHERE codigo = 'N/A'),
  'X', 'X', 'Ubicación Genérica'
WHERE NOT EXISTS (
  SELECT 1 FROM ubicaciones_bodega WHERE descripcion = 'Ubicación Genérica'
);

UPDATE inventario
SET ubicacion_id = (
  SELECT id FROM ubicaciones_bodega WHERE descripcion = 'Ubicación Genérica' LIMIT 1
)
WHERE tipo = 'PRODUCTO' AND ubicacion_id IS NULL;

-- 3. Vista catalogo_completo (Actualizar)
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
  c.nombre AS categoria_nombre,
  c.color_hex AS categoria_color,
  c.id AS categoria_id,
  u.abreviatura AS unidad_medida,
  u.id AS unidad_medida_id,
  i.stock_actual AS stock_actual,
  i.stock_minimum AS stock_minimo,
  -- Nuevos campos
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

COMMIT;
