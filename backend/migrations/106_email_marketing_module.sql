-- ============================================================
-- Migración 106: Módulo de Email Marketing
-- Fecha: 2026-08-05
-- ============================================================
-- Crea las tablas para el módulo de Email Marketing:
--   email_listas, email_contactos, email_lista_contactos,
--   email_plantillas, email_campanas, email_envios,
--   email_clicks, email_unsubscribes
-- ============================================================

-- ─── Listas de contactos ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_listas (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                 VARCHAR(255) NOT NULL,
  descripcion            TEXT,
  criterio_segmentacion  JSONB DEFAULT '{}',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ
);

-- ─── Contactos de marketing ──────────────────────────────────
-- Entidad independiente; las FKs a contacts/companies son opcionales
-- para poder importar contactos del CRM o crearlos manualmente
CREATE TABLE IF NOT EXISTS email_contactos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  empresa_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  nombre        VARCHAR(255) NOT NULL,
  correo        VARCHAR(255) NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo', 'baja', 'rebotado')),
  origen        VARCHAR(50) DEFAULT 'manual'
                  CHECK (origen IN ('manual', 'importado_crm', 'importado_empresa', 'formulario')),
  unsubscribe_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT email_contactos_correo_uq UNIQUE (correo)
);

CREATE INDEX IF NOT EXISTS idx_email_contactos_correo   ON email_contactos(correo);
CREATE INDEX IF NOT EXISTS idx_email_contactos_estado   ON email_contactos(estado);
CREATE INDEX IF NOT EXISTS idx_email_contactos_token    ON email_contactos(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_email_contactos_empresa  ON email_contactos(empresa_id);

-- ─── Tabla puente lista ↔ contacto ──────────────────────────
CREATE TABLE IF NOT EXISTS email_lista_contactos (
  lista_id    UUID NOT NULL REFERENCES email_listas(id) ON DELETE CASCADE,
  contacto_id UUID NOT NULL REFERENCES email_contactos(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lista_id, contacto_id)
);

CREATE INDEX IF NOT EXISTS idx_email_lista_contactos_lista    ON email_lista_contactos(lista_id);
CREATE INDEX IF NOT EXISTS idx_email_lista_contactos_contacto ON email_lista_contactos(contacto_id);

-- ─── Plantillas de correo ────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_plantillas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               VARCHAR(255) NOT NULL,
  asunto               VARCHAR(500) NOT NULL,
  cuerpo_handlebars    TEXT NOT NULL,
  variables_disponibles JSONB DEFAULT '["nombre","correo","empresa","unsubscribe_url","click_url"]',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

-- ─── Campañas de email ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campanas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(255) NOT NULL,
  plantilla_id    UUID NOT NULL REFERENCES email_plantillas(id),
  lista_id        UUID NOT NULL REFERENCES email_listas(id),
  estado          VARCHAR(20) NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','programada','enviando','completada','cancelada')),
  programada_para TIMESTAMPTZ,
  creado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
  total_envios    INTEGER DEFAULT 0,
  enviados        INTEGER DEFAULT 0,
  fallidos        INTEGER DEFAULT 0,
  abiertos        INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_campanas_estado        ON email_campanas(estado);
CREATE INDEX IF NOT EXISTS idx_email_campanas_programada    ON email_campanas(programada_para);
CREATE INDEX IF NOT EXISTS idx_email_campanas_plantilla     ON email_campanas(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_email_campanas_lista         ON email_campanas(lista_id);

-- ─── Envíos individuales ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_envios (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id        UUID NOT NULL REFERENCES email_campanas(id) ON DELETE CASCADE,
  contacto_id       UUID NOT NULL REFERENCES email_contactos(id) ON DELETE CASCADE,
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','enviado','fallido','rebotado')),
  message_id_graph  TEXT,
  error_mensaje     TEXT,
  enviado_at        TIMESTAMPTZ,
  abierto_at        TIMESTAMPTZ,
  click_count       INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campana_id, contacto_id)
);

CREATE INDEX IF NOT EXISTS idx_email_envios_campana     ON email_envios(campana_id);
CREATE INDEX IF NOT EXISTS idx_email_envios_contacto    ON email_envios(contacto_id);
CREATE INDEX IF NOT EXISTS idx_email_envios_estado      ON email_envios(estado);
CREATE INDEX IF NOT EXISTS idx_email_envios_abierto     ON email_envios(abierto_at);

-- ─── Tracking de clics ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_clicks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id     UUID NOT NULL REFERENCES email_envios(id) ON DELETE CASCADE,
  url_original TEXT NOT NULL,
  clicked_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_clicks_envio ON email_clicks(envio_id);

-- ─── Bajas / Unsubscribes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES email_contactos(id) ON DELETE CASCADE,
  campana_id  UUID REFERENCES email_campanas(id) ON DELETE SET NULL,
  motivo      VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_contacto ON email_unsubscribes(contacto_id);
