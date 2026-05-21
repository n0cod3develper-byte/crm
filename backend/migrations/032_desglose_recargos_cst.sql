-- ============================================================
-- Migración 032: Desglose completo de recargos según CST
-- Agrega tabla de detalle minuto a minuto, campos de desglose
-- en turnos_tecnicos, y endpoints para auditoría de recargos.
-- ============================================================

-- 1. TABLA: turno_minutos_detalle
CREATE TABLE IF NOT EXISTS turno_minutos_detalle (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id            UUID NOT NULL REFERENCES turnos_tecnicos(id) ON DELETE CASCADE,
  recargo_codigo      VARCHAR(50) NOT NULL REFERENCES recargos_config(codigo),
  hora_inicio         TIMESTAMP NOT NULL,
  hora_fin            TIMESTAMP NOT NULL,
  minutos             INT NOT NULL,
  es_extra            BOOLEAN NOT NULL DEFAULT FALSE,
  es_dominical_festivo BOOLEAN NOT NULL DEFAULT FALSE,
  porcentaje_recargo  DECIMAL(5,2) NOT NULL,
  total_pct           DECIMAL(5,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_turno_detalle_turno
  ON turno_minutos_detalle(turno_id);

-- 2. ALTER TABLE: turnos_tecnicos
ALTER TABLE turnos_tecnicos
  ADD COLUMN IF NOT EXISTS min_ord_diurnos       INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_ord_nocturnos     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_extra_diurnos     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_extra_nocturnos   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_dom_fest_ord      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_dom_fest_extra_d  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_dom_fest_extra_n  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_domingo            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS es_festivo            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nombre_festivo        VARCHAR(100);
