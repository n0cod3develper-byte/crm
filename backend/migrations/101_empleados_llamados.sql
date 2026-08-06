-- Migracion 101: Llamados de Atencion y Felicitaciones
-- Fecha: 2026-08-01

CREATE TABLE IF NOT EXISTS empleados_llamados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('LLAMADO_ATENCION', 'FELICITACION')),
  gravedad        VARCHAR(20) CHECK (gravedad IN ('VERBAL', 'ESCRITO')),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion     TEXT NOT NULL,
  observaciones   TEXT,
  registrado_por  UUID REFERENCES users(id) ON DELETE SET NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'CERRADO' CHECK (estado IN ('PENDIENTE_DESCARGOS', 'CERRADO')),
  fecha_descargos DATE,
  respuesta_empleado TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_el_empleado ON empleados_llamados (empleado_id);
CREATE INDEX IF NOT EXISTS idx_el_tipo ON empleados_llamados (tipo);
CREATE INDEX IF NOT EXISTS idx_el_fecha ON empleados_llamados (fecha DESC);
