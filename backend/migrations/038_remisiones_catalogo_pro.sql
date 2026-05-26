-- Migración 038: Cambiar FK de remisiones para usar el Catálogo PRO (inventario)
-- En lugar de catalogo_servicios → apuntar a inventario

-- 1. Eliminar el FK viejo (hacia catalogo_servicios)
ALTER TABLE remisiones DROP CONSTRAINT IF EXISTS remisiones_catalogo_servicio_id_fkey;

-- 2. Hacer la columna nullable para no romper registros existentes que ya tienen
--    un UUID de catalogo_servicios (ahora no existe en inventario)
ALTER TABLE remisiones ALTER COLUMN catalogo_servicio_id DROP NOT NULL;

-- 3. No agregamos FK nuevo para mantener compatibilidad con remisiones históricas.
--    Los nuevos registros usarán IDs del catálogo PRO (inventario).

-- 4. Índice de soporte para la búsqueda
CREATE INDEX IF NOT EXISTS idx_remisiones_catalogo_pro ON remisiones(catalogo_servicio_id)
  WHERE catalogo_servicio_id IS NOT NULL;
