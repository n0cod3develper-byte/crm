-- Migración 011: Agregar horómetros a días fijos
ALTER TABLE remision_dias_fijo 
ADD COLUMN IF NOT EXISTS horometro_inicial NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS horometro_final NUMERIC(12,2);
