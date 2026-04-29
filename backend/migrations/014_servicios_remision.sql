-- ============================================================
-- Migración 014: Módulo de Servicios / Remisiones
-- ============================================================

-- Inicializar la serie de consecutivos para Remisiones
INSERT INTO consecutivos (id, ultimo_valor) VALUES ('REM', 32961) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS remisiones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_remision       VARCHAR(10) UNIQUE NOT NULL,
  fecha_servicio        DATE NOT NULL,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  catalogo_servicio_id  UUID NOT NULL REFERENCES catalogo_servicios(id) ON DELETE RESTRICT,
  equipo_id             UUID NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  solicitado_por        VARCHAR(150),
  direccion_servicio    TEXT,
  numero_maquina        VARCHAR(50),
  -- Tiempos del servicio
  hora_salida_cargar    TIME,
  hora_llegada_cliente  TIME,
  hora_salida_cliente   TIME,
  hora_llegada_cargar   TIME,
  horometro_salida      DECIMAL(10,1),
  horometro_regreso     DECIMAL(10,1),
  -- Descripción servicio
  cantidad_horas        DECIMAL(6,2) DEFAULT 0,
  valor_hora            DECIMAL(12,2) DEFAULT 0,
  -- Desglose por horario
  horas_diurnas         DECIMAL(5,2) DEFAULT 0,
  valor_hora_diurna     DECIMAL(12,2) DEFAULT 0,
  horas_nocturnas       DECIMAL(5,2) DEFAULT 0,
  valor_hora_nocturna   DECIMAL(12,2) DEFAULT 0,
  horas_fest_diurnas    DECIMAL(5,2) DEFAULT 0,
  valor_hora_fest_dia   DECIMAL(12,2) DEFAULT 0,
  horas_fest_nocturnas  DECIMAL(5,2) DEFAULT 0,
  valor_hora_fest_noc   DECIMAL(12,2) DEFAULT 0,
  horas_otras           DECIMAL(5,2) DEFAULT 0,
  valor_hora_otras      DECIMAL(12,2) DEFAULT 0,
  -- Totales financieros
  total_bruto           DECIMAL(12,2) DEFAULT 0,
  iva_pct               DECIMAL(5,2) DEFAULT 19.00,
  iva_valor             DECIMAL(12,2) DEFAULT 0,
  descuentos            DECIMAL(12,2) DEFAULT 0,
  total_neto            DECIMAL(12,2) DEFAULT 0,
  -- Estado y auditoría
  estado                VARCHAR(30) DEFAULT 'BORRADOR'
                          CHECK (estado IN ('BORRADOR', 'EMITIDO', 'FIRMADO', 'ANULADO')),
  observaciones         TEXT,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS remision_operarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id UUID NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  UNIQUE(remision_id, empleado_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_remisiones_company   ON remisiones(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_remisiones_equipo    ON remisiones(equipo_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_remisiones_estado    ON remisiones(estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_remisiones_fecha     ON remisiones(fecha_servicio DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_remision_operarios   ON remision_operarios(remision_id);
