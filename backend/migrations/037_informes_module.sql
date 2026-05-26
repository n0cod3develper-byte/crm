-- ============================================================
-- Migración 037: Módulo de Informes
-- ============================================================

-- 1. Campo fecha_factura en remisiones
--    Se registra manualmente cuando se genera/entrega la factura
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS fecha_factura   DATE,
  ADD COLUMN IF NOT EXISTS numero_factura  VARCHAR(50);

COMMENT ON COLUMN remisiones.fecha_factura  IS 'Fecha en que se emitió la factura para esta remisión (se llena desde facturación)';
COMMENT ON COLUMN remisiones.numero_factura IS 'Número de factura emitida para esta remisión';

-- 2. Tabla histórico de reportes generados (para comparativas automáticas)
CREATE TABLE IF NOT EXISTS informes_historico (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_informe      VARCHAR(30) NOT NULL
                    CHECK (tipo_informe IN ('TOTALIZADO', 'LIQUIDACION')),
  generado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
  fecha_generacion  TIMESTAMPTZ DEFAULT NOW(),
  filtros_usados    JSONB,
  resumen           JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE informes_historico IS
  'Snapshots de KPIs generados por el módulo de Informes, usados para comparativas automáticas';

-- 3. Índices de soporte para reportes
CREATE INDEX IF NOT EXISTS idx_informes_historico_tipo
  ON informes_historico(tipo_informe, fecha_generacion DESC);

CREATE INDEX IF NOT EXISTS idx_remisiones_informe
  ON remisiones(fecha_servicio DESC, estado, company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rem_horas_informe
  ON remision_horas_laborales(empleado_id, fecha_trabajo DESC);
