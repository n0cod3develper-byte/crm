-- ============================================================
-- Migración 056: Direcciones de Servicio y Relación Contacto-Servicio
-- Fecha: 2026-06-05
-- ============================================================

-- 1. Crear tabla para las múltiples direcciones de servicio de una empresa
CREATE TABLE IF NOT EXISTS company_service_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  address     TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_service_addresses_company ON company_service_addresses(company_id);

-- 2. Modificar remisiones para guardar el ID del contacto que solicita
ALTER TABLE remisiones ADD COLUMN solicitado_por_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
