-- ============================================================
-- Migración 085: Presupuesto Área 1 — Por Línea de Negocio
-- Fecha: 2025-07
-- Descripción:
--   Crea el catálogo de líneas de negocio de Mantenimiento y
--   la tabla de presupuesto mensual por línea de negocio.
--   NO modifica ni elimina budget_equipment ni budget_monthly_detail
--   (Área 2 — Servicios sigue usando esas tablas sin cambios).
-- ============================================================

-- 1. Catálogo de Líneas de Negocio (editable)
CREATE TABLE IF NOT EXISTS budget_business_lines (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    descripcion TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed inicial con las dos líneas confirmadas
INSERT INTO budget_business_lines (nombre, descripcion)
VALUES
    ('Mano de Obra',        'Presupuesto mensual para mano de obra en mantenimiento'),
    ('Repuestos o Insumos', 'Presupuesto mensual para repuestos e insumos en mantenimiento')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Presupuesto mensual por línea de negocio
CREATE TABLE IF NOT EXISTS budget_mantenimiento_mensual (
    id SERIAL PRIMARY KEY,
    linea_negocio_id INTEGER NOT NULL REFERENCES budget_business_lines(id) ON DELETE RESTRICT,
    year  INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2099),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(linea_negocio_id, year, month)
);

-- Índice para consultas frecuentes por año
CREATE INDEX IF NOT EXISTS idx_budget_mant_mensual_year
    ON budget_mantenimiento_mensual (year, linea_negocio_id);
