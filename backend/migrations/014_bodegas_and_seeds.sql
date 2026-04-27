BEGIN;

-- 1. ACTUALIZAR SEEDS REALES DEL NEGOCIO EN catalogo_categorias
-- Reemplazar / Upsert de las familias. 
INSERT INTO catalogo_categorias (nombre, slug, tipo_aplicable, color_hex, icono, orden)
VALUES
('Carrocería','carroceria','PRODUCTO','#6B7280','Car',1),
('Dirección y Frenos','direccion_frenos','PRODUCTO','#DC2626','AlertTriangle',2),
('Filtros e Insumos','filtros_insumos','PRODUCTO','#2563EB','Filter',3),
('Motor','motor','PRODUCTO','#D97706','Settings',4),
('Sistema Hidráulico','hidraulico','PRODUCTO','#7C3AED','Droplets',5),
('Sistema Eléctrico','electrico','PRODUCTO','#F59E0B','Zap',6),
('Transmisión','transmision','PRODUCTO','#059669','GitMerge',7),
('Rodamientos y Sellos','rodamientos_sellos','PRODUCTO','#EC4899','Circle',8),
('Baterías','baterias','PRODUCTO','#10B981','Battery',9),
('Consumibles Generales','consumibles','PRODUCTO','#9CA3AF','Package',10),
('Mano de Obra','mano_obra','SERVICIO','#1D4ED8','Wrench',11),
('Visitas Técnicas','visitas','SERVICIO','#7C3AED','MapPin',12),
('Diagnósticos','diagnosticos','SERVICIO','#059669','Search',13),
('Servicios Especiales','servicios_esp','SERVICIO','#DC2626','Star',14)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  tipo_aplicable = EXCLUDED.tipo_aplicable,
  color_hex = EXCLUDED.color_hex,
  icono = EXCLUDED.icono,
  orden = EXCLUDED.orden;

-- 2. NUEVO SISTEMA PROFESIONAL DE UBICACIONES DE BODEGA
CREATE TABLE IF NOT EXISTS ubicaciones_bodega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega VARCHAR(50) DEFAULT 'Principal',
  zona VARCHAR(50),
  estante VARCHAR(50),
  nivel VARCHAR(20),
  posicion VARCHAR(20),
  descripcion VARCHAR(200),
  codigo_qr VARCHAR(100),
  activo BOOLEAN DEFAULT true,
  codigo_ubicacion VARCHAR(100) GENERATED ALWAYS AS (
    UPPER(
      SUBSTRING(COALESCE(bodega, 'PPAL'), 1, 4) || '-' ||
      COALESCE(zona, 'X') || '-' ||
      COALESCE(estante, 'X') || '-' ||
      COALESCE(nivel, 'X') || '-' ||
      COALESCE(posicion, 'X')
    )
  ) STORED
);

-- Evitar duplicados exactos
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicacion_bodega_unica ON ubicaciones_bodega 
  (bodega, COALESCE(zona, 'X'), COALESCE(estante, 'X'), COALESCE(nivel, 'X'), COALESCE(posicion, 'X'));

-- 3. MIGRACIÓN INVENTARIO
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS ubicacion_id UUID REFERENCES ubicaciones_bodega(id);

-- Insertar ubicación principal por defecto para migrar items existentes
INSERT INTO ubicaciones_bodega (bodega, zona, estante, nivel, posicion, descripcion)
VALUES ('Principal', 'General', '1', '1', '1', 'Bodega Principal (Migración)')
ON CONFLICT DO NOTHING;

-- Intentar migrar texto de ubicacion_bodega a la tabla nueva si existiera (muy básico)
-- o simplemente asignar todos los productos físicos a la bodega principal por defecto
UPDATE inventory_items
SET ubicacion_id = (SELECT id FROM ubicaciones_bodega WHERE bodega = 'Principal' AND zona = 'General' LIMIT 1)
WHERE tipo = 'PRODUCTO' AND ubicacion_id IS NULL;

-- Eliminar campo texto libre antiguo
ALTER TABLE inventory_items
  DROP COLUMN IF EXISTS ubicacion_bodega;

COMMIT;
