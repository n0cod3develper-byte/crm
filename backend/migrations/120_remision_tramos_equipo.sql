-- ============================================================
-- Migración 110: Sustitución de Máquina en Remisiones
-- Fecha: 2026-08-12
-- ============================================================
-- Crea la tabla de tramos de equipo por remisión y añade
-- el flag `tiene_sustitucion` para optimizar queries.
-- Las remisiones sin sustitución mantienen comportamiento
-- idéntico al actual (compatibilidad hacia atrás garantizada).
-- ============================================================

BEGIN;

-- 1. Tabla de tramos de asignación de equipo por remisión
CREATE TABLE IF NOT EXISTS remision_tramos_equipo (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id         UUID          NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  equipo_id           UUID          NOT NULL REFERENCES equipos(id)    ON DELETE RESTRICT,
  fecha_inicio        DATE          NOT NULL,
  fecha_fin           DATE,                         -- NULL = tramo vigente (máquina actualmente asignada)
  dias_facturables    DECIMAL(8,2),                 -- calculado y fijado al cerrar el tramo
  motivo              TEXT,                         -- avería, mantenimiento preventivo, solicitud cliente, etc.
  usuario_autorizo_id UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- 2. Índices de optimización
CREATE INDEX IF NOT EXISTS idx_rte_remision
  ON remision_tramos_equipo(remision_id);

CREATE INDEX IF NOT EXISTS idx_rte_equipo
  ON remision_tramos_equipo(equipo_id);

-- Índice parcial para localizar el tramo vigente eficientemente
CREATE INDEX IF NOT EXISTS idx_rte_vigente
  ON remision_tramos_equipo(remision_id)
  WHERE fecha_fin IS NULL;

-- 3. Flag en remisiones para evitar JOIN innecesario en queries de Informes
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS tiene_sustitucion BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_remisiones_tiene_sustitucion
  ON remisiones(tiene_sustitucion)
  WHERE tiene_sustitucion = TRUE;

COMMIT;
