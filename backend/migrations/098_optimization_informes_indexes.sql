-- ============================================================
-- Migración 098: Índices de optimización para informes de Mantenimiento
-- Fecha: 2026-08-01
-- Descripción: Índices para mejorar performance del informe Detalle Equipos
-- ============================================================

-- Índice compuesto para filtrar OTs liquidadas por fecha de liquidación
CREATE INDEX IF NOT EXISTS idx_ot_liquidacion_fecha ON ot_liquidacion (fecha_liquidacion DESC);

-- Índice para filtrar OTs por empresa + estado
CREATE INDEX IF NOT EXISTS idx_ot_empresa_estado ON ordenes_trabajo (empresa_id, estado) WHERE deleted_at IS NULL;

-- Índice para filtrar OTs por equipo + estado
CREATE INDEX IF NOT EXISTS idx_ot_equipo_estado ON ordenes_trabajo (equipo_id, estado) WHERE deleted_at IS NULL;
