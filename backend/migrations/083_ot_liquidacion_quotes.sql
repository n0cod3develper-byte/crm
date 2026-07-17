-- Migración: Agregar soporte de snapshot de cotizaciones en la liquidación de OT

-- 1. Añadir campos a ot_liquidacion
ALTER TABLE ot_liquidacion
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quote_snapshot JSONB;

-- Comentarios explicativos
COMMENT ON COLUMN ot_liquidacion.quote_id IS 'ID de la cotización cliente utilizada (si aplica)';
COMMENT ON COLUMN ot_liquidacion.quote_snapshot IS 'Snapshot inmutable de los ítems y totales de la cotización en el momento de liquidar';
