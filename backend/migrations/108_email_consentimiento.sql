-- Migracion 108: Campos de consentimiento (Habeas Data / Ley 1581)
-- Fecha: 2026-08-05
ALTER TABLE email_contactos
  ADD COLUMN IF NOT EXISTS consentimiento_tipo   VARCHAR(30) NOT NULL DEFAULT 'relacion_comercial'
    CHECK (consentimiento_tipo IN ('explicito', 'relacion_comercial', 'pendiente')),
  ADD COLUMN IF NOT EXISTS consentimiento_fecha  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consentimiento_fuente VARCHAR(200);

UPDATE email_contactos
SET
  consentimiento_tipo   = 'relacion_comercial',
  consentimiento_fuente = CASE origen
    WHEN 'importado_crm'     THEN 'Importado CRM - relacion comercial preexistente'
    WHEN 'importado_empresa' THEN 'Importado Empresas - relacion comercial preexistente'
    WHEN 'formulario'        THEN 'Formulario web - consentimiento explicito'
    ELSE 'Registro manual'
  END,
  consentimiento_fecha  = created_at
WHERE consentimiento_fecha IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_contactos_consentimiento ON email_contactos(consentimiento_tipo);
