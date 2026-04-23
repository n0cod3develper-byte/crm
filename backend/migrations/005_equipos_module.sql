-- ============================================================
-- Migración 005: Módulo de Equipos (Maquinaria)
-- Fecha: 2026-04-10
-- ============================================================

-- Habilitar extensión para búsqueda de texto (debe ir antes de los índices GIN)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabla de Equipos
CREATE TABLE IF NOT EXISTS equipos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca            VARCHAR(100) NOT NULL,
  modelo           VARCHAR(100) NOT NULL,
  serial           VARCHAR(100) UNIQUE NOT NULL,
  motor            VARCHAR(50) NOT NULL CHECK (motor IN ('Mazda', 'Toyota', 'Hyster')),
  combustible      VARCHAR(50) NOT NULL CHECK (combustible IN ('GLP', 'Gasolina', 'Eléctrico', 'Híbrido')),
  capacidad_carga  DECIMAL(5, 1) NOT NULL CHECK (capacidad_carga IN (1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0)),
  color            VARCHAR(50),
  empresa_id       UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_equipos_empresa ON equipos(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipos_serial ON equipos(serial) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipos_filtros ON equipos(motor, combustible, capacidad_carga) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipos_search ON equipos USING gin(marca gin_trgm_ops, modelo gin_trgm_ops) WHERE deleted_at IS NULL;
