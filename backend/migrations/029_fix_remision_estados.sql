-- ============================================================
-- Migración 020: Actualizar estados válidos de remisiones
-- Reemplaza los estados viejos (EMITIDO, FIRMADO) por los nuevos
-- (PENDIENTE, REALIZADA, LIQUIDADA)
-- ============================================================

-- 1. Eliminar el constraint viejo de estado en remisiones
ALTER TABLE remisiones
  DROP CONSTRAINT IF EXISTS remisiones_estado_check;

-- 2. Actualizar registros viejos a estados nuevos equivalentes
UPDATE remisiones SET estado = 'REALIZADA'  WHERE estado = 'FIRMADO';
UPDATE remisiones SET estado = 'PENDIENTE'  WHERE estado = 'EMITIDO';

-- 3. Agregar el nuevo constraint con los estados correctos
ALTER TABLE remisiones
  ADD CONSTRAINT remisiones_estado_check
    CHECK (estado IN ('BORRADOR', 'PENDIENTE', 'REALIZADA', 'LIQUIDADA', 'ANULADO'));
