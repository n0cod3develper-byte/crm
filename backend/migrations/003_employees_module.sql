-- ============================================================
-- Migración 003: Módulo de Empleados
-- Fecha: 2026-04-10
-- ============================================================

-- Tabla de Empleados
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  email         VARCHAR(255) UNIQUE NOT NULL,
  position      VARCHAR(50) NOT NULL CHECK (position IN ('Administrativo', 'Operario', 'Técnico')),
  status        VARCHAR(30) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Vacaciones')),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL, -- Opcional: Vincular a usuario de sistema
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(full_name);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(position);
