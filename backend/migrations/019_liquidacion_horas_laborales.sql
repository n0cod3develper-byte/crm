-- ============================================================
-- Migración 019: Liquidación de Horas Laborales CARGAR S.A.S.
-- ============================================================

-- 1. Salario mensual en empleados (operarios/técnicos)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12,2) DEFAULT 0;

-- 2. Tabla de liquidación de horas por operario / remisión
--    hora_entrada y hora_salida se leen de remisiones.hora_llegada_cargar
--    y remisiones.hora_salida_cargar pero se guardan como snapshot.
CREATE TABLE IF NOT EXISTS remision_horas_laborales (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id            UUID NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  empleado_id            UUID NOT NULL REFERENCES employees(id),
  fecha_trabajo          DATE NOT NULL,
  hora_entrada           TIME NOT NULL,   -- snapshot hora_llegada_cargar
  hora_salida            TIME NOT NULL,   -- snapshot hora_salida_cargar (o la que se use)

  salario_mensual        DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_hora_base        DECIMAL(14,4) NOT NULL DEFAULT 0,  -- salario / 220

  -- Minutos por tipo de hora
  min_ord_diurna         INT NOT NULL DEFAULT 0,
  min_ord_nocturna       INT NOT NULL DEFAULT 0,
  min_extra_diurna       INT NOT NULL DEFAULT 0,
  min_extra_nocturna     INT NOT NULL DEFAULT 0,
  min_dom_diurna         INT NOT NULL DEFAULT 0,
  min_dom_nocturna       INT NOT NULL DEFAULT 0,
  min_extra_dom_diurna   INT NOT NULL DEFAULT 0,
  min_extra_dom_nocturna INT NOT NULL DEFAULT 0,

  -- Valores liquidados por tipo (COP)
  val_ord_diurna         DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_ord_nocturna       DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_extra_diurna       DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_extra_nocturna     DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_dom_diurna         DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_dom_nocturna       DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_extra_dom_diurna   DECIMAL(12,2) NOT NULL DEFAULT 0,
  val_extra_dom_nocturna DECIMAL(12,2) NOT NULL DEFAULT 0,

  total_liquidado        DECIMAL(12,2) NOT NULL DEFAULT 0,

  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),

  -- Un operario solo puede tener una liquidación por remisión + fecha
  UNIQUE(remision_id, empleado_id, fecha_trabajo)
);

CREATE INDEX IF NOT EXISTS idx_rem_horas_remision
  ON remision_horas_laborales(remision_id);

CREATE INDEX IF NOT EXISTS idx_rem_horas_empleado
  ON remision_horas_laborales(empleado_id);
