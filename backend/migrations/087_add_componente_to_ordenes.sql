-- ============================================================
-- Migración 087: Agregar componente_id a ordenes_trabajo
-- Fecha: 2026-07-17
-- ============================================================

ALTER TABLE ordenes_trabajo 
ADD COLUMN componente_id INTEGER REFERENCES mantenimiento_componentes(id) ON DELETE SET NULL;

-- Índice para búsquedas rápidas (necesario para el KPI de Reincidencia)
CREATE INDEX IF NOT EXISTS idx_ot_componente ON ordenes_trabajo(componente_id);
