-- ============================================================
-- Migración 104: Correo personal de empleado + Tokens OTP para certificados públicos
-- Fecha: 2026-08-01
-- ============================================================

-- 1. Agregar campo correo_personal a employees (para el portal público)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS correo_personal VARCHAR(255);

COMMENT ON COLUMN employees.correo_personal IS 'Correo electrónico personal del empleado. Se usa para enviar códigos OTP en el portal público de descarga de certificados.';

CREATE INDEX IF NOT EXISTS idx_employees_correo_personal ON employees(correo_personal);

-- 2. Tabla de tokens OTP para verificación de certificados públicos
CREATE TABLE IF NOT EXISTS certificado_otp_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  numero_doc    VARCHAR(30) NOT NULL,
  token_hash    VARCHAR(64) NOT NULL, -- SHA-256 del código OTP
  correo_enviado VARCHAR(255) NOT NULL,
  intentos_fallidos INT DEFAULT 0,
  max_intentos  INT DEFAULT 5,
  usado         BOOLEAN DEFAULT FALSE,
  ip_solicitante VARCHAR(45),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE certificado_otp_tokens IS 'Tokens OTP de un solo uso para el portal público de descarga de certificados laborales.';

CREATE INDEX IF NOT EXISTS idx_otp_empleado ON certificado_otp_tokens(empleado_id);
CREATE INDEX IF NOT EXISTS idx_otp_hash ON certificado_otp_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON certificado_otp_tokens(expires_at);

-- 3. Limpiar tokens expirados automáticamente
DELETE FROM certificado_otp_tokens WHERE expires_at < NOW() - INTERVAL '1 day';
