-- =========================================================
-- MIGRACIÓN: Módulo de Gestión Documental
-- Proyecto: CARGAR CRM
-- Fecha: 2026-06-03 (Consolidación)
-- =========================================================

BEGIN;

-- 1. Catálogo de tipos de documento
CREATE TABLE IF NOT EXISTS tipos_documento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(100) NOT NULL,
  slug            VARCHAR(80)  UNIQUE NOT NULL,
  aplica_a        VARCHAR(20)  NOT NULL
                  CHECK (aplica_a IN ('EMPRESA','PROVEEDOR','AMBOS','OT')),
  es_obligatorio  BOOLEAN DEFAULT FALSE,
  descripcion     TEXT,
  activo          BOOLEAN DEFAULT TRUE,
  orden           INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Seeds: tipos de documento iniciales
INSERT INTO tipos_documento (nombre, slug, aplica_a, es_obligatorio, orden) VALUES
  ('RUT',                        'rut',               'AMBOS',      TRUE,  1),
  ('Cámara de Comercio',         'camara_comercio',   'AMBOS',      TRUE,  2),
  ('Contrato de Servicio',       'contrato_servicio', 'EMPRESA',    FALSE, 3),
  ('Acuerdo de Confidencialidad','acuerdo_nda',       'EMPRESA',    FALSE, 4),
  ('Certificado RUT Vigente',    'cert_rut_vigente',  'AMBOS',      FALSE, 5),
  ('Certificado Bancario',       'cert_bancario',     'PROVEEDOR',  FALSE, 6),
  ('Portafolio de Servicios',    'portafolio',        'PROVEEDOR',  FALSE, 7),
  ('Certificación Técnica',      'cert_tecnica',      'PROVEEDOR',  FALSE, 8),
  ('Orden de Trabajo Firmada',   'ot_firmada',        'OT',         TRUE,  9)
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabla central de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento_id UUID REFERENCES tipos_documento(id),
  entidad_tipo      VARCHAR(20) NOT NULL
                    CHECK (entidad_tipo IN ('EMPRESA','PROVEEDOR','OT')),
  entidad_id        UUID NOT NULL,
  nombre_original   VARCHAR(255) NOT NULL,
  nombre_disco      VARCHAR(255) NOT NULL,
  ruta_relativa     VARCHAR(500) NOT NULL,
  nombre_display    VARCHAR(255) NOT NULL,
  descripcion       TEXT,
  formato           VARCHAR(20),
  tamano_bytes      BIGINT,
  tiene_thumb       BOOLEAN DEFAULT FALSE,
  estado            VARCHAR(20) DEFAULT 'ACTIVO'
                    CHECK (estado IN ('ACTIVO','ARCHIVADO','ELIMINADO')),
  es_confidencial   BOOLEAN DEFAULT FALSE,
  subido_por        VARCHAR(100) NOT NULL,
  fecha_documento   DATE,
  fecha_vencimiento DATE,
  mime_type         VARCHAR(120),
  es_visualizable_inline BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_entidad ON documentos(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_docs_tipo    ON documentos(tipo_documento_id);
CREATE INDEX IF NOT EXISTS idx_docs_estado  ON documentos(estado);

-- 3. Campos de control documental en ordenes_trabajo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordenes_trabajo' AND column_name = 'ot_firmada_doc_id'
  ) THEN
    ALTER TABLE ordenes_trabajo ADD COLUMN ot_firmada_doc_id UUID REFERENCES documentos(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordenes_trabajo' AND column_name = 'ot_firmada_requerida'
  ) THEN
    ALTER TABLE ordenes_trabajo ADD COLUMN ot_firmada_requerida BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- 4. Vista para verificar si una OT puede liquidarse
CREATE OR REPLACE VIEW ot_puede_liquidar AS
SELECT
  ot.id,
  ot.consecutivo,
  ot.estado,
  ot.ot_firmada_requerida,
  ot.ot_firmada_doc_id,
  CASE
    WHEN ot.ot_firmada_requerida = FALSE THEN TRUE
    WHEN ot.ot_firmada_doc_id IS NOT NULL THEN TRUE
    ELSE FALSE
  END AS puede_liquidar,
  d.ruta_relativa AS ruta_ot_firmada
FROM ordenes_trabajo ot
LEFT JOIN documentos d ON d.id = ot.ot_firmada_doc_id;

COMMIT;
