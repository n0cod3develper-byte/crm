-- ============================================================
-- Migración 118: Tabla de subrayados para informe de Gestión Humana
-- Fecha: 2026-08-24
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS gestion_humana_subrayados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remision_id UUID NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT  uq_gestion_humana_subrayado UNIQUE (usuario_id, remision_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_subrayados_usuario ON gestion_humana_subrayados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gh_subrayados_remision ON gestion_humana_subrayados(remision_id);

COMMIT;
