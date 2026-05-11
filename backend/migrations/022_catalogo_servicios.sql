-- ============================================================
-- Migración 013: Catálogo de Servicios
-- ============================================================

CREATE TABLE IF NOT EXISTS catalogo_servicios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(50) UNIQUE NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  precio_base DECIMAL(12,2) DEFAULT 0,
  unidad      VARCHAR(50) DEFAULT 'hora',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_servicios_activo ON catalogo_servicios(is_active);

-- Datos iniciales de ejemplo
INSERT INTO catalogo_servicios (codigo, nombre, descripcion, precio_base, unidad) VALUES
  ('MC-2.5-OPR-COMB', 'SERVICIO DE MONTACARGAS DE 2.5 TONELADAS CON OPERARIO CON COMBUSTIBLE', 'Servicio de alquiler de montacargas de 2.5 ton con operario calificado incluye combustible ordinario', 65000, 'hora'),
  ('MC-2.5-OPR', 'SERVICIO DE MONTACARGAS DE 2.5 TONELADAS CON OPERARIO SIN COMBUSTIBLE', 'Servicio de alquiler de montacargas de 2.5 ton con operario calificado sin combustible', 55000, 'hora'),
  ('MTO-PREV', 'MANTENIMIENTO PREVENTIVO', 'Servicio de mantenimiento preventivo programado de montacargas', 0, 'servicio'),
  ('MTO-CORR', 'MANTENIMIENTO CORRECTIVO', 'Servicio de mantenimiento correctivo de montacargas', 0, 'servicio')
ON CONFLICT DO NOTHING;
