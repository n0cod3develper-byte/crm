-- ============================================================
-- Migración 128: Módulo Horas Extras — Configuración y Detalle
-- Fecha: 2026-09-14
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. TABLA DE CONFIGURACIÓN DE HORAS EXTRAS
--    Horarios, porcentajes y jornada por tipo de día.
--    Fuente de verdad para el motor de cálculo.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horas_extras_configuracion (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_hora               VARCHAR(50) NOT NULL,
  nombre                  VARCHAR(100) NOT NULL,
  porcentaje              DECIMAL(5,2) NOT NULL,
  hora_inicio             TIME NOT NULL,
  hora_fin                TIME NOT NULL,
  dia_aplicacion          VARCHAR(30) NOT NULL,
  jornada_maxima_minutos  INT NOT NULL DEFAULT 420,
  es_liquidable           BOOLEAN NOT NULL DEFAULT TRUE,
  activo                  BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tipo_hora, dia_aplicacion)
);

CREATE INDEX IF NOT EXISTS idx_he_config_tipo ON horas_extras_configuracion(tipo_hora);
CREATE INDEX IF NOT EXISTS idx_he_config_dia  ON horas_extras_configuracion(dia_aplicacion);

-- ─────────────────────────────────────────────────────────────
-- 2. SEED: Configuración inicial CARGAR S.A.S.
-- ─────────────────────────────────────────────────────────────

-- LUNES A JUEVES (NO FESTIVO)
INSERT INTO horas_extras_configuracion (tipo_hora, nombre, porcentaje, hora_inicio, hora_fin, dia_aplicacion, jornada_maxima_minutos, es_liquidable) VALUES
  ('ORDINARIA_DIURNA',    'Ordinaria Diurna',    100, '07:00', '16:15', 'LUN_JUE', 420, FALSE),
  ('EXTRA_DIURNA',        'Extra Diurna',        125, '16:15', '19:00', 'LUN_JUE', 420, TRUE),
  ('ORDINARIA_NOCTURNA',  'Ordinaria Nocturna',  135, '19:00', '06:00', 'LUN_JUE', 420, TRUE),
  ('EXTRA_NOCTURNA',      'Extra Nocturna',      175, '19:00', '06:00', 'LUN_JUE', 420, TRUE)
ON CONFLICT (tipo_hora, dia_aplicacion) DO NOTHING;

-- VIERNES (NO FESTIVO)
INSERT INTO horas_extras_configuracion (tipo_hora, nombre, porcentaje, hora_inicio, hora_fin, dia_aplicacion, jornada_maxima_minutos, es_liquidable) VALUES
  ('ORDINARIA_DIURNA',    'Ordinaria Diurna',    100, '07:00', '16:10', 'VIE', 420, FALSE),
  ('EXTRA_DIURNA',        'Extra Diurna',        125, '16:10', '19:00', 'VIE', 420, TRUE),
  ('ORDINARIA_NOCTURNA',  'Ordinaria Nocturna',  135, '19:00', '06:00', 'VIE', 420, TRUE),
  ('EXTRA_NOCTURNA',      'Extra Nocturna',      175, '19:00', '06:00', 'VIE', 420, TRUE)
ON CONFLICT (tipo_hora, dia_aplicacion) DO NOTHING;

-- SÁBADO (NO FESTIVO) — No hay jornada ordinaria diurna
INSERT INTO horas_extras_configuracion (tipo_hora, nombre, porcentaje, hora_inicio, hora_fin, dia_aplicacion, jornada_maxima_minutos, es_liquidable) VALUES
  ('ORDINARIA_DIURNA',    'Ordinaria Diurna',    100, '07:00', '07:00', 'SAB', 420, FALSE),
  ('EXTRA_DIURNA',        'Extra Diurna',        125, '06:00', '19:00', 'SAB', 420, TRUE),
  ('ORDINARIA_NOCTURNA',  'Ordinaria Nocturna',  135, '19:00', '06:00', 'SAB', 420, TRUE),
  ('EXTRA_NOCTURNA',      'Extra Nocturna',      175, '19:00', '06:00', 'SAB', 420, TRUE)
ON CONFLICT (tipo_hora, dia_aplicacion) DO NOTHING;

-- DOMINGO / FESTIVO
INSERT INTO horas_extras_configuracion (tipo_hora, nombre, porcentaje, hora_inicio, hora_fin, dia_aplicacion, jornada_maxima_minutos, es_liquidable) VALUES
  ('ORDINARIA_DIURNA',                'Ordinaria Diurna',                100, '06:00', '19:00', 'DOM_FESTIVO', 420, FALSE),
  ('DOMINICAL_FESTIVA_DIURNA',        'Dominical/Festiva Diurna',        190, '06:00', '19:00', 'DOM_FESTIVO', 420, TRUE),
  ('DOMINICAL_FESTIVA_NOCTURNA',      'Dominical/Festiva Nocturna',      225, '19:00', '06:00', 'DOM_FESTIVO', 420, TRUE),
  ('EXTRA_DOMINICAL_FESTIVA_DIURNA',  'Extra Dom./Festiva Diurna',       215, '06:00', '19:00', 'DOM_FESTIVO', 420, TRUE),
  ('EXTRA_DOMINICAL_FESTIVA_NOCTURNA','Extra Dom./Festiva Nocturna',     265, '19:00', '06:00', 'DOM_FESTIVO', 420, TRUE)
ON CONFLICT (tipo_hora, dia_aplicacion) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. TABLA DE DETALLE DE HORAS EXTRAS (segmentos clasificados)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horas_extras_detalle (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horas_laborales_id    UUID NOT NULL REFERENCES remision_horas_laborales(id) ON DELETE CASCADE,
  tipo_hora             VARCHAR(50) NOT NULL,
  porcentaje            DECIMAL(5,2) NOT NULL,
  hora_inicio           TIME NOT NULL,
  hora_fin              TIME NOT NULL,
  minutos               INT NOT NULL,
  horas_decimal         DECIMAL(8,4) NOT NULL,
  valor_hora            DECIMAL(14,4) NOT NULL DEFAULT 0,
  subtotal              DECIMAL(12,2) NOT NULL DEFAULT 0,
  es_liquidable         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_he_detalle_hl ON horas_extras_detalle(horas_laborales_id);
CREATE INDEX IF NOT EXISTS idx_he_detalle_tipo ON horas_extras_detalle(tipo_hora);

-- ─────────────────────────────────────────────────────────────
-- 4. ALTER remision_horas_laborales: campos adicionales
-- ─────────────────────────────────────────────────────────────
ALTER TABLE remision_horas_laborales
  ADD COLUMN IF NOT EXISTS horas_remision            DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_calculadas          DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_base_liquidacion    DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_horas_extras        DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_horas_gestion_humana DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_liquidacion        VARCHAR(30) DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS alerta                    TEXT,
  ADD COLUMN IF NOT EXISTS alerta_tipo               VARCHAR(50);

-- ─────────────────────────────────────────────────────────────
-- 5. Verificar festivos 2026 (spec §16)
--    Ya existen en migración 030. Verificamos San Pedro y San Pablo.
-- ─────────────────────────────────────────────────────────────
INSERT INTO festivos_colombia (fecha, nombre, tipo, anio) VALUES
  ('2026-06-29', 'San Pedro y San Pablo', 'LEY_EMILIANI', 2026)
ON CONFLICT (fecha) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Actualizar fecha correcta según spec (29 de junio, no 6 de julio)
-- La migración 030 tiene '2026-07-06', la spec dice '2026-06-29'
-- Mantenemos ambas por seguridad; la de la spec prevalece.

COMMIT;
