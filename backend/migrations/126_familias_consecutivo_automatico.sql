-- Migracion 126: Consecutivo automatico de ubicacion por familia
-- Cada familia tiene un consecutivo de estanteria automatico (001, 002, 003, ...)
-- y todos los productos de la misma familia comparten ese consecutivo.

BEGIN;

-- 1. Actualizar funcion trigger para preservar codigo_ubicacion cuando no se use prefijo/nivel
CREATE OR REPLACE FUNCTION generate_ubicacion_code() RETURNS TRIGGER AS $$
DECLARE
  prefijo_cod VARCHAR(10);
  nivel_cod VARCHAR(10);
BEGIN
  IF NEW.prefijo_id IS NULL AND NEW.nivel_id IS NULL AND NEW.codigo_ubicacion IS NOT NULL AND NEW.codigo_ubicacion != '' THEN
    RETURN NEW;
  END IF;

  SELECT codigo INTO prefijo_cod FROM ubicacion_prefijos WHERE id = NEW.prefijo_id;
  SELECT codigo INTO nivel_cod FROM ubicacion_niveles WHERE id = NEW.nivel_id;
  
  IF prefijo_cod IS NOT NULL OR nivel_cod IS NOT NULL THEN
    NEW.codigo_ubicacion := UPPER(
      COALESCE(prefijo_cod, 'X') || '-' ||
      COALESCE(nivel_cod, 'X') || '-' ||
      COALESCE(NEW.orientacion, 'X') || '-' ||
      COALESCE(NEW.nueva_posicion, 'X')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Asegurar el consecutivo para familias en la tabla consecutivos
INSERT INTO consecutivos (id, ultimo_valor)
VALUES ('familia_estanteria', 0)
ON CONFLICT (id) DO NOTHING;

-- 3. Crear/asignar consecutivos 001, 002, ... a todas las categorias existentes
DO $$
DECLARE
  cat RECORD;
  next_seq INT := 0;
  ubi_id UUID;
  code_str VARCHAR(10);
BEGIN
  -- Ordenar dando prioridad a Sistema Eléctrico para que sea 001
  FOR cat IN (
    SELECT id, nombre FROM catalogo_categorias 
    ORDER BY 
      CASE WHEN LOWER(nombre) LIKE '%eléctrico%' OR LOWER(nombre) LIKE '%electrico%' THEN 0 ELSE 1 END,
      orden ASC, 
      nombre ASC
  ) LOOP
    next_seq := next_seq + 1;
    code_str := LPAD(next_seq::text, 3, '0');

    -- Crear ubicacion de bodega con el consecutivo
    INSERT INTO ubicaciones_bodega (codigo_ubicacion, descripcion, activo)
    VALUES (code_str, 'Estantería ' || cat.nombre, true)
    RETURNING id INTO ubi_id;

    -- Vincular la categoria a su ubicacion
    UPDATE catalogo_categorias
    SET ubicacion_default_id = ubi_id
    WHERE id = cat.id;

    -- Actualizar los productos existentes de esta categoria con esta ubicacion
    UPDATE inventario
    SET ubicacion_id = ubi_id
    WHERE categoria_id = cat.id AND (ubicacion_id IS NULL OR ubicacion_id IN (SELECT id FROM ubicaciones_bodega WHERE codigo_ubicacion = 'SIN-N/A-X-X' OR codigo_ubicacion = 'X-X-X-X'));
  END LOOP;

  -- Actualizar el valor del consecutivo global
  UPDATE consecutivos
  SET ultimo_valor = next_seq
  WHERE id = 'familia_estanteria';
END $$;

COMMIT;
