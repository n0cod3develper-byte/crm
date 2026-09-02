-- ============================================================
-- Migración 105: Sincronización del consecutivo de Remisiones
-- ============================================================
--
-- ⚠️  IMPORTANTE — SALTO INTENCIONAL (NO ES UN ERROR)
-- ============================================================
-- El consecutivo de remisiones (serie 'REM') se ajusta de 33191 a 33510
-- para que la próxima remisión generada use el número 33511.
--
-- MOTIVO: Sincronización con una numeración externa previa.
-- Las remisiones anteriores al 33191 corresponden a pruebas internas
-- (no productivas) y NO deben tomarse como referencia de continuidad
-- numérica.
--
-- El salto entre 33192 y 33510 es INTENCIONAL y está documentado aquí.
-- No debe corregirse ni interpretarse como un error.
-- ============================================================

-- La serie REM se inicializó en 32961 (migración 023) y la última
-- remisión productiva fue 33191. Se fuerza el valor a 33510 para que
-- la siguiente remisión creada reciba el consecutivo 33511.
--
-- El guard AND ultimo_valor < 33510 protege contra colisiones UNIQUE
-- en numero_remision: si el contador ya avanzó más allá de 33510
-- (restauración de backup o re-ejecución), no se baja el valor.
UPDATE consecutivos
   SET ultimo_valor = 33510
 WHERE id = 'REM' AND ultimo_valor < 33510;

-- Verificación (debe devolver 33510):
-- SELECT ultimo_valor FROM consecutivos WHERE id = 'REM';
