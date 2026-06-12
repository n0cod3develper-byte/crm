-- ============================================================
-- Migración 063: Servicios / Remisiones — Equipo Opcional
-- Fecha: 2026-06-11
-- ============================================================

BEGIN;

-- 1. Alterar tabla remisiones para hacer equipo_id nulo (opcional)
ALTER TABLE remisiones ALTER COLUMN equipo_id DROP NOT NULL;

COMMIT;
