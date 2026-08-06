-- Migration 102: Salud Ocupacional para Empleados
-- Tables: empleados_examenes, empleados_restricciones, empleados_epp, empleados_accidentes

CREATE TABLE IF NOT EXISTS empleados_examenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('INGRESO', 'PERIODICO', 'EGRESO', 'RETORNO')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  resultado VARCHAR(30) NOT NULL CHECK (resultado IN ('APTO', 'APTO_CON_RESTRICCIONES', 'NO_APTO')),
  observaciones TEXT,
  archivo_adjunto TEXT,
  registrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empleados_restricciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  registrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empleados_epp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  elemento VARCHAR(100) NOT NULL,
  fecha_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  registrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empleados_accidentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo VARCHAR(50) NOT NULL,
  descripcion TEXT NOT NULL,
  genero_incapacidad BOOLEAN NOT NULL DEFAULT FALSE,
  dias_incapacidad INTEGER,
  registrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_examen_empleado ON empleados_examenes (empleado_id);
CREATE INDEX IF NOT EXISTS idx_restriccion_empleado ON empleados_restricciones (empleado_id);
CREATE INDEX IF NOT EXISTS idx_epp_empleado ON empleados_epp (empleado_id);
CREATE INDEX IF NOT EXISTS idx_accidente_empleado ON empleados_accidentes (empleado_id);
