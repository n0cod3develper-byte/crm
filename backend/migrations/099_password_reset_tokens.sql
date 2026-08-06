-- ============================================================
-- Migración 099: Tabla de tokens de recuperación de contraseña
-- Fecha: 2026-08-01
-- Descripción: Tabla para almacenar tokens de un solo uso
--              para el flujo de "Olvidé mi contraseña"
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ DEFAULT NULL,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_expires_at ON password_reset_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_prt_user_active ON password_reset_tokens (user_id, used_at, created_at DESC);
