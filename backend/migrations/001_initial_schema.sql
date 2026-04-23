-- ============================================================
-- Migración 001: Schema inicial completo CARGAR CRM
-- Fecha: 2026-04-07
-- ============================================================

-- Extensión para UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USUARIOS Y AUTENTICACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  role          VARCHAR(50) NOT NULL DEFAULT 'agent'
                  CHECK (role IN ('admin','agent','viewer')),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(50) NOT NULL CHECK (provider IN ('google','microsoft')),
  provider_id   VARCHAR(255) NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  token_expiry  TIMESTAMPTZ,
  UNIQUE(provider, provider_id)
);

-- ============================================================
-- EMPRESAS Y CONTACTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  nit         VARCHAR(20) UNIQUE,
  industry    VARCHAR(100) DEFAULT 'logistics',
  website     TEXT,
  phone       VARCHAR(30),
  address     TEXT,
  city        VARCHAR(100),
  country     VARCHAR(100) DEFAULT 'Colombia',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  tags        TEXT[] DEFAULT '{}',
  notes       TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100),
  email       VARCHAR(255),
  phone       VARCHAR(30),
  whatsapp    VARCHAR(30),
  position    VARCHAR(100),
  is_primary  BOOLEAN DEFAULT FALSE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  tags        TEXT[] DEFAULT '{}',
  notes       TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PIPELINE DE VENTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  order_index     INT NOT NULL,
  color           VARCHAR(7) DEFAULT '#6366f1',
  probability     INT DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  is_closed_won   BOOLEAN DEFAULT FALSE,
  is_closed_lost  BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255) NOT NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  stage_id        UUID NOT NULL REFERENCES pipeline_stages(id),
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  value           NUMERIC(15,2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'COP',
  expected_close  DATE,
  probability     INT DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  source          VARCHAR(100),
  lost_reason     TEXT,
  won_at          TIMESTAMPTZ,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage_id   UUID REFERENCES pipeline_stages(id),
  to_stage_id     UUID NOT NULL REFERENCES pipeline_stages(id),
  changed_by      UUID REFERENCES users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COTIZACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    VARCHAR(20) UNIQUE NOT NULL,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id),
  status          VARCHAR(30) DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired')),
  subtotal        NUMERIC(15,2) DEFAULT 0,
  tax_rate        NUMERIC(5,2) DEFAULT 19.0,
  tax_amount      NUMERIC(15,2) DEFAULT 0,
  total           NUMERIC(15,2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'COP',
  valid_until     DATE,
  notes           TEXT,
  pdf_url         TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount    NUMERIC(5,2) DEFAULT 0,
  subtotal    NUMERIC(15,2) GENERATED ALWAYS AS
                (quantity * unit_price * (1 - discount/100)) STORED,
  order_index INT DEFAULT 0
);

-- ============================================================
-- TAREAS Y ACTIVIDADES
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  type         VARCHAR(50) DEFAULT 'task'
                 CHECK (type IN ('task','call','meeting','email','follow_up')),
  status       VARCHAR(30) DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','completed','cancelled')),
  priority     VARCHAR(20) DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  related_type VARCHAR(50),
  related_id   UUID,
  due_date     TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMUNICACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS communications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           VARCHAR(30) NOT NULL
                   CHECK (type IN ('email','call','whatsapp','meeting','note')),
  direction      VARCHAR(10) DEFAULT 'outbound'
                   CHECK (direction IN ('inbound','outbound')),
  subject        VARCHAR(255),
  body           TEXT,
  duration_sec   INT,
  company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id),
  occurred_at    TIMESTAMPTZ DEFAULT NOW(),
  external_id    VARCHAR(255),
  call_record_id UUID,
  metadata       JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS Y CAMPAÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(50) CHECK (type IN ('email','whatsapp','social','referral')),
  status      VARCHAR(30) DEFAULT 'draft'
                CHECK (status IN ('draft','active','paused','completed')),
  budget      NUMERIC(12,2),
  start_date  DATE,
  end_date    DATE,
  created_by  UUID REFERENCES users(id),
  metrics     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name           VARCHAR(100) NOT NULL,
  last_name            VARCHAR(100),
  email                VARCHAR(255),
  phone                VARCHAR(30),
  company_name         VARCHAR(255),
  source               VARCHAR(100),
  campaign_id          UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  status               VARCHAR(30) DEFAULT 'new'
                         CHECK (status IN ('new','contacted','qualified','converted','dead')),
  score                INT DEFAULT 0,
  assigned_to          UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_contact_id UUID REFERENCES contacts(id),
  converted_at         TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           VARCHAR(50) UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(100),
  unit          VARCHAR(30) DEFAULT 'unidad',
  unit_cost     NUMERIC(15,2) DEFAULT 0,
  unit_price    NUMERIC(15,2) DEFAULT 0,
  stock_current INT DEFAULT 0,
  stock_minimum INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES inventory_items(id),
  type        VARCHAR(20) NOT NULL CHECK (type IN ('in','out','adjustment')),
  quantity    INT NOT NULL,
  reference   VARCHAR(255),
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SOPORTE AL CLIENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  status        VARCHAR(30) DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  priority      VARCHAR(20) DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATIZACIONES E IA
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(255) NOT NULL,
  is_active          BOOLEAN DEFAULT TRUE,
  trigger_type       VARCHAR(100) NOT NULL,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  actions            JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status         VARCHAR(20) CHECK (status IN ('success','error','skipped')),
  context        JSONB,
  error_message  TEXT,
  executed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  context_type VARCHAR(50),
  context_id   UUID,
  suggestion   TEXT NOT NULL,
  action_type  VARCHAR(100),
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_applied   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTEGRACIÓN ASTERISK (CENTRAL TELEFÓNICA)
-- ============================================================
CREATE TABLE IF NOT EXISTS asterisk_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL DEFAULT 'Principal',
  ami_host            VARCHAR(255) NOT NULL,
  ami_port            INT NOT NULL DEFAULT 5038,
  ami_user            VARCHAR(100) NOT NULL,
  ami_secret          TEXT NOT NULL,
  ari_base_url        TEXT,
  ari_user            VARCHAR(100),
  ari_password        TEXT,
  recording_path      TEXT,
  recording_s3_prefix TEXT DEFAULT 'recordings/',
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asterisk_extensions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  extension    VARCHAR(20) NOT NULL,
  display_name VARCHAR(100),
  is_active    BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS call_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asterisk_uniqueid VARCHAR(100) UNIQUE NOT NULL,
  asterisk_linkedid VARCHAR(100),
  channel           VARCHAR(255),
  destination       VARCHAR(100),
  caller_number     VARCHAR(30),
  called_number     VARCHAR(30),
  direction         VARCHAR(10) CHECK (direction IN ('inbound','outbound','internal')),
  status            VARCHAR(30)
                      CHECK (status IN ('answered','no_answer','busy','failed','ringing')),
  started_at        TIMESTAMPTZ NOT NULL,
  answered_at       TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  recording_filename TEXT,
  recording_url      TEXT,
  agent_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_id         UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
  opportunity_id     UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  communication_id   UUID,
  screen_pop_shown   BOOLEAN DEFAULT FALSE,
  ami_raw_event      JSONB,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_companies_name      ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_assigned  ON companies(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_company    ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email      ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone      ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned ON opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunities_close ON opportunities(expected_close);
CREATE INDEX IF NOT EXISTS idx_communications_company ON communications(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_contact ON communications(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due  ON tasks(assigned_to, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_related       ON tasks(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_leads_status        ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements ON inventory_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user ON ai_suggestions(user_id, is_dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_caller  ON call_records(caller_number, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_contact ON call_records(contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_agent   ON call_records(agent_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_uniqueid ON call_records(asterisk_uniqueid);

-- ============================================================
-- DATOS INICIALES — Pipeline stages por defecto
-- ============================================================
INSERT INTO pipeline_stages (name, order_index, color, probability) VALUES
  ('Prospecto',        1, '#94a3b8', 10),
  ('Calificado',       2, '#60a5fa', 25),
  ('Propuesta',        3, '#a78bfa', 50),
  ('Negociación',      4, '#fb923c', 70),
  ('Ganado',           5, '#4ade80', 100),
  ('Perdido',          6, '#f87171', 0)
ON CONFLICT DO NOTHING;

UPDATE pipeline_stages SET is_closed_won  = TRUE WHERE name = 'Ganado';
UPDATE pipeline_stages SET is_closed_lost = TRUE WHERE name = 'Perdido';
