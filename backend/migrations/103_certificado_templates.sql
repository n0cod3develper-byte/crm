-- Migration 103: Plantillas personalizables de certificado laboral
-- Multiple templates with version history

CREATE TABLE IF NOT EXISTS certificado_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  contenido TEXT NOT NULL,
  variables_disponibles JSONB NOT NULL DEFAULT '[]',
  es_predeterminada BOOLEAN DEFAULT FALSE,
  activa BOOLEAN DEFAULT TRUE,
  creado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_activa ON certificado_templates(activa);
CREATE INDEX IF NOT EXISTS idx_ct_predeterminada ON certificado_templates(es_predeterminada);

-- Version history table
CREATE TABLE IF NOT EXISTS certificado_template_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES certificado_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  contenido TEXT NOT NULL,
  variables_disponibles JSONB NOT NULL DEFAULT '[]',
  modificado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctv_template ON certificado_template_versiones(template_id);

-- Track which template version was used for each certificate generation
ALTER TABLE employees ADD COLUMN IF NOT EXISTS certificado_template_id UUID;

-- Insert a default template
INSERT INTO certificado_templates (nombre, descripcion, contenido, variables_disponibles, es_predeterminada)
VALUES (
  'Certificado Laboral Estándar',
  'Plantilla predeterminada para certificados laborales de CARGAR S.A.S.',
  'La empresa CARGAR S.A.S., identificada con NIT 890919352-2, hace constar que el/la señor(a) {{nombre_completo}}, identificado(a) con {{tipo_documento}} No. {{numero_documento}}, se encuentra vinculado(a) a nuestra empresa desde el {{fecha_ingreso}}{{#if fecha_retiro}} hasta el {{fecha_retiro}}{{/if}}, desempeñando el cargo de {{cargo}}, con un tipo de contrato a {{tipo_contrato}}.{{#if mostrar_salario}}

Su remuneración mensual es de {{salario}}{{#if antiguedad}}, con una antigüedad de {{antiguedad}}{{/if}}.{{/if}}{{#if motivo_retiro}}

El motivo de retiro fue: {{motivo_retiro}}.{{/if}}

Se expide el presente certificado a solicitud del interesado(a) para los fines legales que estime convenientes.',
  '["nombre_completo","tipo_documento","numero_documento","cargo","departamento","fecha_ingreso","fecha_retiro","tipo_contrato","salario","jornada","antiguedad","motivo_retiro","fecha_expedicion","firma_nombre","firma_cargo","mostrar_salario"]'::jsonb,
  TRUE
);
