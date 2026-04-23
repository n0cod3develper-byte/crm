-- ============================================================
-- Migración 002: Módulo de Soporte — ajustes tabla support_tickets
-- Fecha: 2026-04-10
-- ============================================================

-- Columna soft-delete en support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(status)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_company  ON support_tickets(company_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket   ON ticket_messages(ticket_id, created_at ASC);
