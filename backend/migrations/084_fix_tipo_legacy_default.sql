-- MIGRACIÓN 084: Agregar DEFAULT a tipo_legacy en movimientos_inventario
-- La columna tipo_legacy es un campo legacy que quedó sin DEFAULT, causando
-- error NOT NULL cuando el código nuevo usa solo tipo_movimiento.

BEGIN;

-- Agregar DEFAULT a tipo_legacy
ALTER TABLE movimientos_inventario
  ALTER COLUMN tipo_legacy SET DEFAULT 'adjustment';

-- Actualizar registros existentes que puedan tener NULL
UPDATE movimientos_inventario
SET tipo_legacy = CASE
  WHEN tipo_movimiento LIKE 'ENTRADA%' OR tipo_movimiento = 'TRASLADO_ENTRADA' THEN 'in'
  WHEN tipo_movimiento LIKE 'SALIDA%' OR tipo_movimiento = 'TRASLADO_SALIDA' THEN 'out'
  ELSE 'adjustment'
END
WHERE tipo_legacy IS NULL;

COMMIT;
