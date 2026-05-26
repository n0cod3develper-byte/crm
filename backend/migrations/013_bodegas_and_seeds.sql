BEGIN;


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
WHERE ubicacion_id IS NULL;

-- Eliminar campo texto libre antiguo
ALTER TABLE inventory_items
  DROP COLUMN IF EXISTS ubicacion_bodega;

COMMIT;
