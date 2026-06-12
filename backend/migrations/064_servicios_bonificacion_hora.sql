-- ============================================================
-- Migración 064: Servicios / Remisiones — Campo Bonificación por Hora
-- Fecha: 2026-06-11
-- ============================================================

BEGIN;

-- 1. Agregar columna bonificacion_hora a la tabla remisiones
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS bonificacion_hora DECIMAL(12, 2) DEFAULT 0;

COMMIT;
