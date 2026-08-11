-- Migración 012: Tabla para ajustes manuales de liquidación de bonificación
CREATE TABLE IF NOT EXISTS liquidacion_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id UUID NOT NULL,
  quincena VARCHAR(20) NOT NULL,
  horas_ajustadas NUMERIC(10,2),
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(remision_id, quincena)
);
