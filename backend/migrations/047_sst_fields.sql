-- ============================================================
-- Migracion 047: Campos SST (Seguridad y Salud en el Trabajo)
-- para la tabla inventario.
-- 
-- Agrega campos de control de vencimientos, tipo de elemento,
-- certificacion y responsable, similar al sistema SOAT.
-- ============================================================

BEGIN;

ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS sst_tipo_elemento   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sst_codigo_elemento  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sst_marca_modelo     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sst_numero_serie     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sst_ubicacion        VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sst_ultima_revision  DATE,
  ADD COLUMN IF NOT EXISTS sst_proxima_revision DATE,
  ADD COLUMN IF NOT EXISTS sst_frecuencia_dias  INTEGER DEFAULT 365,
  ADD COLUMN IF NOT EXISTS sst_fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS sst_estado           VARCHAR(30) NOT NULL DEFAULT 'VIGENTE',
  ADD COLUMN IF NOT EXISTS sst_certificado      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sst_responsable_id   UUID,
  ADD COLUMN IF NOT EXISTS sst_observaciones    TEXT;

CREATE INDEX IF NOT EXISTS idx_inventario_sst_proxima_revision ON inventario (sst_proxima_revision);
CREATE INDEX IF NOT EXISTS idx_inventario_sst_estado          ON inventario (sst_estado);
CREATE INDEX IF NOT EXISTS idx_inventario_sst_tipo_elemento   ON inventario (sst_tipo_elemento);

COMMIT;
