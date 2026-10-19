-- ============================================================
-- Migración 088: Crear tabla documentos y tipos_documento + campos mime
-- La tabla documentos nunca fue creada en migraciones anteriores.
-- Se crea aquí junto con tipos_documento y luego se agregan
-- las columnas mime_type y es_visualizable_inline.
-- ============================================================

BEGIN;

-- 1. Tabla de tipos de documento (catálogo)
CREATE TABLE IF NOT EXISTS tipos_documento (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            VARCHAR(150) NOT NULL,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  aplica_a          VARCHAR(20) DEFAULT 'AMBOS'
    CHECK (aplica_a IN ('EMPRESA', 'PROVEEDOR', 'EMPLEADO', 'OT', 'EQUIPO', 'AMBOS')),
  es_obligatorio    BOOLEAN DEFAULT FALSE,
  activo            BOOLEAN DEFAULT TRUE,
  orden             INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Seeds iniciales de tipos de documento
INSERT INTO tipos_documento (nombre, slug, aplica_a, es_obligatorio, orden) VALUES
  ('RUT',                    'rut',           'AMBOS',    TRUE,  1),
  ('Cámara de Comercio',     'camara_comercio','AMBOS',   TRUE,  2),
  ('Cédula Representante',   'cedula_rep',    'AMBOS',    FALSE, 3),
  ('Contrato',               'contrato',      'AMBOS',    FALSE, 4),
  ('Póliza de Seguros',      'poliza',        'AMBOS',    FALSE, 5),
  ('Certificado Bancario',   'cert_bancario', 'AMBOS',    FALSE, 6),
  ('OT Firmada',             'ot_firmada',    'OT',       FALSE, 10),
  ('Foto Evidencia',         'foto_evidencia','OT',       FALSE, 11),
  ('Hoja de Vida Equipo',    'hv_equipo',     'EQUIPO',   FALSE, 20),
  ('Otro',                   'otro',          'AMBOS',    FALSE, 99)
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabla principal de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento_id     UUID REFERENCES tipos_documento(id),
  entidad_tipo          VARCHAR(30) NOT NULL,
  entidad_id            UUID NOT NULL,
  nombre_original       VARCHAR(500) NOT NULL,
  nombre_disco          VARCHAR(500),
  ruta_relativa         VARCHAR(1000),
  nombre_display        VARCHAR(500),
  descripcion           TEXT,
  formato               VARCHAR(20),
  tamano_bytes          BIGINT,
  tiene_thumb           BOOLEAN DEFAULT FALSE,
  es_confidencial       BOOLEAN DEFAULT FALSE,
  subido_por            UUID REFERENCES users(id) ON DELETE SET NULL,
  fecha_documento       DATE,
  fecha_vencimiento     DATE,
  estado                VARCHAR(20) DEFAULT 'ACTIVO'
    CHECK (estado IN ('ACTIVO', 'ARCHIVADO', 'ELIMINADO')),
  mime_type             VARCHAR(150),
  es_visualizable_inline BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_entidad ON documentos(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo_documento_id);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);

COMMIT;
