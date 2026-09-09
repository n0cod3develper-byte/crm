-- Migracion 127: Fix indice unico ubicaciones_bodega
-- El indice original (migracion 014) bloqueaba cualquier ubicacion "generica"
-- adicional (sin zona/estante/nivel/posicion), lo cual rompia tanto la migracion 126
-- (crea una ubicacion generica por cada familia/categoria) como la creacion normal
-- de items desde CatalogController.
-- Se reemplaza por un indice parcial: solo protege contra duplicados cuando existe
-- jerarquia real (al menos uno de zona/estante/nivel/posicion no nulo).

BEGIN;

DROP INDEX IF EXISTS idx_ubicacion_bodega_unica;

CREATE UNIQUE INDEX idx_ubicacion_bodega_unica ON ubicaciones_bodega
  (bodega, COALESCE(zona,'X'), COALESCE(estante,'X'), COALESCE(nivel,'X'), COALESCE(posicion,'X'))
  WHERE zona IS NOT NULL OR estante IS NOT NULL OR nivel IS NOT NULL OR posicion IS NOT NULL;

COMMIT;