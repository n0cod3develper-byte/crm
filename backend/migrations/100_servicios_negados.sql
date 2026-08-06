-- ============================================================
-- Migración 100: Tabla de servicios/mantenimientos negados
-- Fecha: 2026-08-01
-- Descripción: Registro de solicitudes de servicio rechazadas
-- ============================================================

CREATE TABLE IF NOT EXISTS servicios_negados (
  id              BIGSERIAL PRIMARY KEY,
  fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
  empresa_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  empresa_nombre  VARCHAR(255) NOT NULL DEFAULT '',
  tipo_equipo     VARCHAR(100) NOT NULL,
  causa           VARCHAR(100) NOT NULL,
  observacion     TEXT DEFAULT '',
  valor_estimado  NUMERIC(12,2) DEFAULT 0,
  registrado_por  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sn_empresa ON servicios_negados (empresa_id);
CREATE INDEX IF NOT EXISTS idx_sn_fecha ON servicios_negados (fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_sn_causa ON servicios_negados (causa);
