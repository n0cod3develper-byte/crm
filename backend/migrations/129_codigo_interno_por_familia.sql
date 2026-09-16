-- ============================================================
-- MIGRACIÓN 129: Código Interno Autoincremental por Familia
-- Cada familia (catalogo_categorias) tiene su propio rango
-- numérico y su propio contador de código interno.
-- Ejemplo: Sistema Eléctrico → 1000, 1001, 1002 ...
--          Motor             → 2000, 2001, 2002 ...
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Agregar columnas de consecutivo a catalogo_categorias
-- ============================================================

-- codigo_interno_base: número de inicio del rango (Ej: 1000, 2000)
ALTER TABLE catalogo_categorias
  ADD COLUMN IF NOT EXISTS codigo_interno_base INT;

-- ultimo_codigo_int: último código asignado (contador atómico)
ALTER TABLE catalogo_categorias
  ADD COLUMN IF NOT EXISTS ultimo_codigo_int INT DEFAULT 0;

-- ============================================================
-- 2. Seed: asignar base a todas las familias existentes
-- ============================================================

UPDATE catalogo_categorias SET codigo_interno_base = 1000 WHERE slug = 'electrico';
UPDATE catalogo_categorias SET codigo_interno_base = 2000 WHERE slug = 'motor'; -- si existe como slug
UPDATE catalogo_categorias SET codigo_interno_base = 2000 WHERE nombre ILIKE 'Motor%' AND slug NOT IN ('motor', 'filtros_insumos', 'mano_obra') AND (codigo_interno_base IS NULL OR codigo_interno_base > 90000);

UPDATE catalogo_categorias SET codigo_interno_base = 3000 WHERE slug = 'hidraulico';
UPDATE catalogo_categorias SET codigo_interno_base = 4000 WHERE slug = 'transmision';
UPDATE catalogo_categorias SET codigo_interno_base = 5000 WHERE slug = 'filtros_insumos';
UPDATE catalogo_categorias SET codigo_interno_base = 6000 WHERE slug = 'direccion_frenos';
UPDATE catalogo_categorias SET codigo_interno_base = 7000 WHERE slug = 'rodamientos_sellos';
UPDATE catalogo_categorias SET codigo_interno_base = 8000 WHERE slug = 'baterias';
UPDATE catalogo_categorias SET codigo_interno_base = 9000 WHERE slug = 'carroceria';
UPDATE catalogo_categorias SET codigo_interno_base = 9500 WHERE slug = 'consumibles';

-- Área LOCATIVO
UPDATE catalogo_categorias SET codigo_interno_base = 10000 WHERE slug = 'muebles-enseres';
UPDATE catalogo_categorias SET codigo_interno_base = 10100 WHERE slug = 'aires-acondicionados';
UPDATE catalogo_categorias SET codigo_interno_base = 10200 WHERE slug = 'equipos-oficina';
UPDATE catalogo_categorias SET codigo_interno_base = 10300 WHERE slug = 'extintores';
UPDATE catalogo_categorias SET codigo_interno_base = 10400 WHERE slug = 'cocina-cafeteria';

-- Área SISTEMAS
UPDATE catalogo_categorias SET codigo_interno_base = 11000 WHERE slug = 'equipos-computo';
UPDATE catalogo_categorias SET codigo_interno_base = 11100 WHERE slug = 'redes-telecom';
UPDATE catalogo_categorias SET codigo_interno_base = 11200 WHERE slug = 'camaras-vigilancia';
UPDATE catalogo_categorias SET codigo_interno_base = 11300 WHERE slug = 'servidores-ups';
UPDATE catalogo_categorias SET codigo_interno_base = 11400 WHERE slug = 'licencias-software';

-- Área SST
UPDATE catalogo_categorias SET codigo_interno_base = 12000 WHERE slug = 'botiquines';
UPDATE catalogo_categorias SET codigo_interno_base = 12100 WHERE slug = 'epp';
UPDATE catalogo_categorias SET codigo_interno_base = 12200 WHERE slug = 'senalizacion';
UPDATE catalogo_categorias SET codigo_interno_base = 12300 WHERE slug = 'camillas-rescate';
UPDATE catalogo_categorias SET codigo_interno_base = 12400 WHERE slug = 'implementos-sst';

-- Servicios
UPDATE catalogo_categorias SET codigo_interno_base = 90000 WHERE slug = 'mano_obra';
UPDATE catalogo_categorias SET codigo_interno_base = 90100 WHERE slug = 'visitas';
UPDATE catalogo_categorias SET codigo_interno_base = 90200 WHERE slug = 'diagnosticos';
UPDATE catalogo_categorias SET codigo_interno_base = 90300 WHERE slug = 'servicios_esp';

-- Lubricantes (migración 013) - mantener compatibilidad
UPDATE catalogo_categorias SET codigo_interno_base = 9600 WHERE slug = 'lubricantes' AND codigo_interno_base IS NULL;

-- ============================================================
-- 3. Reasignar codigo_interno a los PRODUCTOS con PRD-
--    Ordena por created_at dentro de cada familia y asigna
--    base + 0, base + 1, base + 2, etc.
-- ============================================================

DO $$
DECLARE
  rec       RECORD;
  fam       RECORD;
  offset_n  INT;
  new_code  TEXT;
BEGIN
  -- Recorrer cada familia que tenga base definida
  FOR fam IN
    SELECT id, nombre, codigo_interno_base
    FROM catalogo_categorias
    WHERE codigo_interno_base IS NOT NULL
    ORDER BY codigo_interno_base ASC
  LOOP
    offset_n := 0;

    -- Recorrer los productos de esta familia con código PRD- ordenados por fecha
    FOR rec IN
      SELECT id, codigo_interno
      FROM inventario
      WHERE tipo = 'PRODUCTO'
        AND categoria_id = fam.id
        AND codigo_interno LIKE 'PRD-%'
      ORDER BY created_at ASC, id ASC
    LOOP
      new_code := (fam.codigo_interno_base + offset_n)::TEXT;

      UPDATE inventario
        SET codigo_interno = new_code
      WHERE id = rec.id;

      offset_n := offset_n + 1;
    END LOOP;

    -- Actualizar el contador de la familia para que el próximo
    -- registro arranque desde donde quedó la reasignación
    UPDATE catalogo_categorias
      SET ultimo_codigo_int = offset_n
    WHERE id = fam.id;

  END LOOP;
END $$;

-- ============================================================
-- 4. Para familias sin base aún, asignar base automática
--    usando MAX(codigo_interno_base) + 100
--    (solo familias que tienen productos sin código numérico)
-- ============================================================

DO $$
DECLARE
  max_base INT;
  fam      RECORD;
BEGIN
  FOR fam IN
    SELECT id, nombre
    FROM catalogo_categorias
    WHERE codigo_interno_base IS NULL
    ORDER BY orden ASC, nombre ASC
  LOOP
    SELECT COALESCE(MAX(codigo_interno_base), 0) + 100
      INTO max_base
    FROM catalogo_categorias
    WHERE codigo_interno_base IS NOT NULL;

    UPDATE catalogo_categorias
      SET codigo_interno_base = max_base,
          ultimo_codigo_int   = 0
    WHERE id = fam.id;
  END LOOP;
END $$;

-- ============================================================
-- 5. Función atómica: generar_codigo_por_familia
--    Incrementa ultimo_codigo_int con FOR UPDATE para evitar
--    condiciones de carrera en inserciones concurrentes.
-- ============================================================

CREATE OR REPLACE FUNCTION generar_codigo_por_familia(p_categoria_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_base     INT;
  v_next_off INT;
  v_code     TEXT;
BEGIN
  -- Bloquear la fila de la familia para escritura atómica
  SELECT codigo_interno_base, ultimo_codigo_int + 1
    INTO v_base, v_next_off
    FROM catalogo_categorias
   WHERE id = p_categoria_id
     FOR UPDATE;

  IF v_base IS NULL THEN
    -- Familia sin base: calcular y asignar base automática
    SELECT COALESCE(MAX(codigo_interno_base), 0) + 100
      INTO v_base
      FROM catalogo_categorias
     WHERE codigo_interno_base IS NOT NULL;

    UPDATE catalogo_categorias
       SET codigo_interno_base = v_base,
           ultimo_codigo_int   = 1
     WHERE id = p_categoria_id;

    v_next_off := 1;
  ELSE
    -- Incrementar el contador
    UPDATE catalogo_categorias
       SET ultimo_codigo_int = v_next_off
     WHERE id = p_categoria_id;
  END IF;

  v_code := (v_base + v_next_off - 1)::TEXT;
  RETURN v_code;
END;
$$;

-- ============================================================
-- 6. Trigger: auto-asignar base a familias nuevas
--    Si se inserta una categoría sin codigo_interno_base,
--    se le asigna MAX(base existente) + 100 automáticamente.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_asignar_base_familia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  max_base INT;
BEGIN
  IF NEW.codigo_interno_base IS NULL THEN
    SELECT COALESCE(MAX(codigo_interno_base), 900) + 100
      INTO max_base
      FROM catalogo_categorias
     WHERE codigo_interno_base IS NOT NULL;

    NEW.codigo_interno_base := max_base;
    NEW.ultimo_codigo_int   := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_familia_base ON catalogo_categorias;
CREATE TRIGGER trg_familia_base
  BEFORE INSERT ON catalogo_categorias
  FOR EACH ROW
  EXECUTE FUNCTION trg_asignar_base_familia();

-- ============================================================
-- 7. Índice para evitar duplicados de codigo_interno en inventario
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventario_codigo_interno_unique
  ON inventario (codigo_interno)
  WHERE codigo_interno IS NOT NULL AND activo_catalogo = TRUE;

COMMIT;
