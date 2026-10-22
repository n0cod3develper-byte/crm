-- ============================================================
-- MIGRACIÓN 145: Consecutivo de Ubicación por Familia
-- Cada familia (catalogo_categorias) tiene su propio contador
-- de ubicación física que arranca en 001 (001, 002, 003...).
-- Se provee la función atómica generar_ubicacion_por_familia()
-- con SELECT FOR UPDATE para garantizar concurrencia segura.
-- ============================================================

BEGIN;

-- 1. Agregar columna de control a catalogo_categorias
ALTER TABLE catalogo_categorias
  ADD COLUMN IF NOT EXISTS ultimo_consecutivo_ubicacion INT DEFAULT 0;

-- 2. Inicializar contadores para familias existentes
-- Para Sistema Eléctrico (que ya tiene 137 ubicaciones 001..137 asignadas):
UPDATE catalogo_categorias c
SET ultimo_consecutivo_ubicacion = COALESCE((
  SELECT MAX(
    CASE 
      WHEN ub.codigo_ubicacion ~ '^\d+$' THEN ub.codigo_ubicacion::INTEGER 
      ELSE 0 
    END
  )
  FROM inventario i
  JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
  WHERE i.categoria_id = c.id 
    AND i.tipo = 'PRODUCTO'
    AND ub.descripcion ILIKE 'Posición %'
), 0)
WHERE ultimo_consecutivo_ubicacion IS NULL OR ultimo_consecutivo_ubicacion = 0;

-- 3. Función atómica para generar ubicaciones consecutivas por familia
CREATE OR REPLACE FUNCTION generar_ubicacion_por_familia(p_categoria_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_num INT;
  v_cat_nom  TEXT;
  v_code     TEXT;
  v_ubi_id   UUID;
BEGIN
  IF p_categoria_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Bloquear la fila de la categoría para escritura concurrente atómica
  SELECT nombre, COALESCE(ultimo_consecutivo_ubicacion, 0) + 1
    INTO v_cat_nom, v_next_num
    FROM catalogo_categorias
   WHERE id = p_categoria_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría % no encontrada', p_categoria_id;
  END IF;

  -- Incrementar el contador atómico en la categoría
  UPDATE catalogo_categorias
     SET ultimo_consecutivo_ubicacion = v_next_num
   WHERE id = p_categoria_id;

  -- Formatear con al menos 3 dígitos: 001, 002... 999, 1000...
  IF v_next_num < 1000 THEN
    v_code := LPAD(v_next_num::TEXT, 3, '0');
  ELSE
    v_code := v_next_num::TEXT;
  END IF;

  -- Crear la posición en ubicaciones_bodega
  INSERT INTO ubicaciones_bodega (
    codigo_ubicacion,
    descripcion,
    activo,
    bodega
  ) VALUES (
    v_code,
    'Posición ' || v_code || ' - ' || v_cat_nom,
    TRUE,
    'Principal'
  )
  RETURNING id INTO v_ubi_id;

  RETURN v_ubi_id;
END;
$$;

COMMIT;
