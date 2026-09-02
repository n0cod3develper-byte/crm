-- ============================================================
-- Migración 111: Repuestos Compatibles por equipo
-- ============================================================

CREATE TABLE IF NOT EXISTS equipos_repuestos_compatibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  aceite_motor VARCHAR(255),
  filtro_glp VARCHAR(255),
  filtro_aire VARCHAR(255),
  lubricante_cadena VARCHAR(255),
  grasa VARCHAR(255),
  filtro_combustible VARCHAR(255),
  filtro_motor VARCHAR(255),
  filtro_bomba_gasolina VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipo_id)
);

CREATE INDEX IF NOT EXISTS idx_equipos_repuestos_equipo_id ON equipos_repuestos_compatibles(equipo_id);
