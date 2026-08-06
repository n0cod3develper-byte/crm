-- ============================================================
-- Migración 097: Tabla de Auditoría de Peticiones HTTP (audit_logs)
-- Fecha: 2026-08-01
-- Descripción: Registra automáticamente las operaciones de escritura (CREATE/UPDATE/DELETE)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name     VARCHAR(255),
  modulo        VARCHAR(50) NOT NULL,
  accion        VARCHAR(100) NOT NULL,
  ruta          VARCHAR(255) NOT NULL,
  metodo        VARCHAR(10) NOT NULL,
  datos_antes   JSONB,
  datos_despues JSONB,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_audit_logs_modulo_fecha ON audit_logs (modulo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
