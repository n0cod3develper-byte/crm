-- ============================================================
-- Migración 030: Módulo de Control de Turnos y Horas Extras
-- Fecha: 2026-05-20
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CONFIGURACIÓN DE TURNOS (parámetros configurables)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion_turnos (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_normal_min          INT NOT NULL DEFAULT 440,
  -- 440 = 7h 20min = 7.33h jornada ordinaria colombiana (44h / 6 días)

  hora_inicio_diurno          TIME NOT NULL DEFAULT '06:00:00',
  hora_fin_diurno             TIME NOT NULL DEFAULT '21:00:00',
  -- Horas extras diurnas: entre 06:00 y 21:00
  -- Horas extras nocturnas: entre 21:00 y 06:00 (del día siguiente)

  limite_extras_diarias_min   INT DEFAULT 120,
  -- 2 horas = 120 minutos (CST Art. 167)

  limite_extras_semanales_min INT DEFAULT 720,
  -- 12 horas = 720 minutos (CST Art. 167)

  cerrar_turno_automatico     BOOLEAN DEFAULT TRUE,
  -- TRUE: job nocturno cierra turnos abiertos a medianoche

  hora_cierre_automatico      TIME DEFAULT '23:59:00',

  activo                      BOOLEAN DEFAULT TRUE,
  updated_by                  VARCHAR(100),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- Configuración inicial
INSERT INTO configuracion_turnos DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. TURNOS DE TÉCNICOS (contenedor del día laboral)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS turnos_tecnicos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id             UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  fecha_turno             DATE NOT NULL,
  -- Fecha del día laboral (sin hora). Una por técnico por día.

  -- Estado del turno
  estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
    CHECK (estado IN (
      'ACTIVO',       -- turno en curso
      'CERRADO',      -- técnico registró fin de turno (Evento 5)
      'CERRADO_AUTO'  -- cerrado automáticamente por job nocturno
    )),

  -- Evento 1 implícito: inicio del turno = primera salida_cargar del día
  inicio_turno            TIMESTAMP,

  -- Evento 5: fin de turno (registro manual del técnico)
  fin_turno               TIMESTAMP,

  -- Cálculos del turno (calculados al cerrar)
  tiempo_total_min        INT,
  jornada_normal_min      INT DEFAULT 440,
  minutos_extras          INT DEFAULT 0,
  horas_extras            DECIMAL(5,2) DEFAULT 0,

  -- Clasificación CST colombiano
  horas_extras_diurnas    DECIMAL(5,2) DEFAULT 0,   -- extras entre 06:00-21:00
  horas_extras_nocturnas  DECIMAL(5,2) DEFAULT 0,   -- extras entre 21:00-06:00

  -- Alerta de límite legal (> 2h extras/día)
  alerta_limite_legal     BOOLEAN DEFAULT FALSE,

  -- Aprobación supervisor
  observaciones           TEXT,
  aprobado_por            VARCHAR(100), -- user.id del supervisor
  fecha_aprobacion        TIMESTAMP,

  -- Origen del registro (preparado para biométrico)
  origen_inicio           VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_inicio IN ('MANUAL','BIOMETRICO','APP_MOVIL')),
  origen_fin              VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_fin IN ('MANUAL','BIOMETRICO','APP_MOVIL')),

  -- Auditoría
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW(),

  -- Un técnico solo puede tener UN turno por día
  UNIQUE (empleado_id, fecha_turno)
);

CREATE INDEX IF NOT EXISTS idx_turnos_empleado_fecha
  ON turnos_tecnicos(empleado_id, fecha_turno DESC);

CREATE INDEX IF NOT EXISTS idx_turnos_estado_activo
  ON turnos_tecnicos(estado)
  WHERE estado = 'ACTIVO';

CREATE INDEX IF NOT EXISTS idx_turnos_fecha
  ON turnos_tecnicos(fecha_turno DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. TURNO SERVICIOS (cada salida a campo dentro del turno)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS turno_servicios (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id                        UUID NOT NULL REFERENCES turnos_tecnicos(id) ON DELETE CASCADE,
  empleado_id                     UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  orden_trabajo_id                UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  -- NULL si el técnico sale a actividad sin OT (raro pero posible)

  numero_servicio_dia             INT NOT NULL DEFAULT 1,
  -- Orden del servicio dentro del turno: 1, 2, 3...

  estado_servicio                 VARCHAR(20) NOT NULL DEFAULT 'EN_DESPLAZAMIENTO'
    CHECK (estado_servicio IN (
      'EN_DESPLAZAMIENTO', -- entre Evento 1 y Evento 2
      'EN_SERVICIO',       -- entre Evento 2 y Evento 3
      'REGRESANDO',        -- entre Evento 3 y Evento 4
      'COMPLETADO'         -- Evento 4 registrado
    )),

  -- ── LOS 5 EVENTOS ─────────────────────────────────────────

  -- EVENTO 1: Salida de CARGAR
  salida_cargar                   TIMESTAMP,
  origen_salida_cargar            VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_salida_cargar IN ('MANUAL','BIOMETRICO','APP_MOVIL')),

  -- EVENTO 2: Inicio del servicio (llega donde el cliente)
  inicio_servicio                 TIMESTAMP,
  origen_inicio_servicio          VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_inicio_servicio IN ('MANUAL','BIOMETRICO','APP_MOVIL')),
  ubicacion_cliente               VARCHAR(200),

  -- EVENTO 3: Fin del servicio (termina el trabajo)
  fin_servicio                    TIMESTAMP,
  origen_fin_servicio             VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_fin_servicio IN ('MANUAL','BIOMETRICO','APP_MOVIL')),

  -- EVENTO 4: Ingreso a CARGAR
  ingreso_cargar                  TIMESTAMP,
  origen_ingreso_cargar           VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_ingreso_cargar IN ('MANUAL','BIOMETRICO','APP_MOVIL')),

  -- ── TIEMPOS CALCULADOS ────────────────────────────────────
  tiempo_desplazamiento_ida_min   INT,  -- inicio_servicio - salida_cargar
  tiempo_servicio_efectivo_min    INT,  -- fin_servicio - inicio_servicio
  tiempo_desplazamiento_vuelta_min INT, -- ingreso_cargar - fin_servicio
  tiempo_total_servicio_min       INT,  -- ingreso_cargar - salida_cargar

  -- Notas del técnico al completar
  notas_tecnico                   TEXT,
  tiene_firma_cliente             BOOLEAN DEFAULT FALSE,

  -- Auditoría
  created_at                      TIMESTAMP DEFAULT NOW(),
  updated_at                      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turno_servicios_turno
  ON turno_servicios(turno_id);

CREATE INDEX IF NOT EXISTS idx_turno_servicios_empleado
  ON turno_servicios(empleado_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_turno_servicios_ot
  ON turno_servicios(orden_trabajo_id)
  WHERE orden_trabajo_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. MODIFICACIÓN: ot_tecnicos (agregar referencia al turno)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ot_tecnicos
  ADD COLUMN IF NOT EXISTS turno_servicio_id UUID REFERENCES turno_servicios(id),
  ADD COLUMN IF NOT EXISTS origen_registro VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen_registro IN ('MANUAL','TURNO','BIOMETRICO'));

-- ─────────────────────────────────────────────────────────────
-- 5. FESTIVOS COLOMBIA (2025 y 2026)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festivos_colombia (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha      DATE NOT NULL UNIQUE,
  nombre     VARCHAR(100) NOT NULL,
  tipo       VARCHAR(20) NOT NULL
    CHECK (tipo IN ('FECHA_FIJA','LEY_EMILIANI','MOVIL_RELIGIOSO','PERSONALIZADO')),
  anio       INT NOT NULL,
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON festivos_colombia(fecha);
CREATE INDEX IF NOT EXISTS idx_festivos_anio  ON festivos_colombia(anio);

-- Seeds: Festivos 2025 (Colombia)
INSERT INTO festivos_colombia (fecha, nombre, tipo, anio) VALUES
  ('2025-01-01', 'Año Nuevo',                              'FECHA_FIJA',      2025),
  ('2025-01-06', 'Reyes Magos',                            'LEY_EMILIANI',    2025),
  ('2025-03-24', 'Día de San José',                        'LEY_EMILIANI',    2025),
  ('2025-04-17', 'Jueves Santo',                           'MOVIL_RELIGIOSO', 2025),
  ('2025-04-18', 'Viernes Santo',                          'MOVIL_RELIGIOSO', 2025),
  ('2025-05-01', 'Día del Trabajo',                        'FECHA_FIJA',      2025),
  ('2025-06-02', 'Ascensión del Señor',                    'MOVIL_RELIGIOSO', 2025),
  ('2025-06-23', 'Corpus Christi',                         'MOVIL_RELIGIOSO', 2025),
  ('2025-06-30', 'Sagrado Corazón',                        'MOVIL_RELIGIOSO', 2025),
  ('2025-06-30', 'San Pedro y San Pablo',                  'LEY_EMILIANI',    2025),
  ('2025-07-20', 'Día de la Independencia',                'FECHA_FIJA',      2025),
  ('2025-08-07', 'Batalla de Boyacá',                      'FECHA_FIJA',      2025),
  ('2025-08-18', 'Asunción de la Virgen',                  'LEY_EMILIANI',    2025),
  ('2025-10-13', 'Día de la Raza',                         'LEY_EMILIANI',    2025),
  ('2025-11-03', 'Todos los Santos',                       'LEY_EMILIANI',    2025),
  ('2025-11-17', 'Independencia de Cartagena',             'LEY_EMILIANI',    2025),
  ('2025-12-08', 'Inmaculada Concepción',                  'FECHA_FIJA',      2025),
  ('2025-12-25', 'Navidad',                                'FECHA_FIJA',      2025)
ON CONFLICT (fecha) DO NOTHING;

-- Seeds: Festivos 2026 (Colombia)
INSERT INTO festivos_colombia (fecha, nombre, tipo, anio) VALUES
  ('2026-01-01', 'Año Nuevo',                              'FECHA_FIJA',      2026),
  ('2026-01-12', 'Reyes Magos',                            'LEY_EMILIANI',    2026),
  ('2026-03-23', 'Día de San José',                        'LEY_EMILIANI',    2026),
  ('2026-04-02', 'Jueves Santo',                           'MOVIL_RELIGIOSO', 2026),
  ('2026-04-03', 'Viernes Santo',                          'MOVIL_RELIGIOSO', 2026),
  ('2026-05-01', 'Día del Trabajo',                        'FECHA_FIJA',      2026),
  ('2026-05-18', 'Ascensión del Señor',                    'MOVIL_RELIGIOSO', 2026),
  ('2026-06-08', 'Corpus Christi',                         'MOVIL_RELIGIOSO', 2026),
  ('2026-06-15', 'Sagrado Corazón',                        'MOVIL_RELIGIOSO', 2026),
  ('2026-07-06', 'San Pedro y San Pablo',                  'LEY_EMILIANI',    2026),
  ('2026-07-20', 'Día de la Independencia',                'FECHA_FIJA',      2026),
  ('2026-08-07', 'Batalla de Boyacá',                      'FECHA_FIJA',      2026),
  ('2026-08-17', 'Asunción de la Virgen',                  'LEY_EMILIANI',    2026),
  ('2026-10-12', 'Día de la Raza',                         'LEY_EMILIANI',    2026),
  ('2026-11-02', 'Todos los Santos',                       'LEY_EMILIANI',    2026),
  ('2026-11-16', 'Independencia de Cartagena',             'LEY_EMILIANI',    2026),
  ('2026-12-08', 'Inmaculada Concepción',                  'FECHA_FIJA',      2026),
  ('2026-12-25', 'Navidad',                                'FECHA_FIJA',      2026)
ON CONFLICT (fecha) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6. RECARGOS CONFIG (CST colombiano)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recargos_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(50) UNIQUE NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  porcentaje  DECIMAL(5,2) NOT NULL, -- recargo SOBRE la hora ordinaria
  total_pct   DECIMAL(5,2) GENERATED ALWAYS AS (100 + porcentaje) STORED,
  activo      BOOLEAN DEFAULT TRUE,
  base_legal  VARCHAR(200),
  updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO recargos_config (codigo, nombre, porcentaje, base_legal) VALUES
  ('ORD_DIURNA',
   'Hora ordinaria diurna',                 0,   'CST Art. 158 — Jornada ordinaria 6am a 9pm'),
  ('ORD_NOCTURNA',
   'Hora ordinaria nocturna',               35,  'CST Art. 168 No.1 — Recargo nocturno 35%'),
  ('EXTRA_DIURNA',
   'Hora extra diurna',                     25,  'CST Art. 168 No.2 — Extra diurna 25%'),
  ('EXTRA_NOCTURNA',
   'Hora extra nocturna',                   75,  'CST Art. 168 No.3 — Extra nocturna 75%'),
  ('DOM_FEST_ORDINARIA',
   'Hora dominical/festivo ordinaria',      75,  'CST Art. 171 — Dominical ordinaria 75%'),
  ('DOM_FEST_EXTRA_DIURNA',
   'Hora extra dominical/festivo diurna',   100, 'CST Art. 171 y 168 — Extra dominical diurna 100%'),
  ('DOM_FEST_EXTRA_NOCTURNA',
   'Hora extra dominical/festivo nocturna', 150, 'CST Art. 171 y 168 — Extra dominical nocturna 150%')
ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 7. VISTA: resumen_turnos_tecnicos
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW resumen_turnos_tecnicos AS
SELECT
  t.id                    AS id,
  t.fecha_turno,
  t.estado,
  -- Empleado
  e.id                    AS empleado_id,
  e.full_name             AS nombre_tecnico,
  e.position              AS cargo,
  -- Turno
  t.inicio_turno,
  t.fin_turno,
  t.tiempo_total_min,
  ROUND(t.tiempo_total_min::NUMERIC / 60, 2)  AS horas_totales,
  t.jornada_normal_min,
  t.minutos_extras,
  t.horas_extras,
  t.horas_extras_diurnas,
  t.horas_extras_nocturnas,
  t.alerta_limite_legal,
  -- Servicios
  COUNT(ts.id)                                            AS total_servicios,
  COUNT(ts.orden_trabajo_id)                              AS total_ots_atendidas,
  COALESCE(SUM(ts.tiempo_servicio_efectivo_min), 0)       AS min_servicio_efectivo,
  COALESCE(SUM(
    COALESCE(ts.tiempo_desplazamiento_ida_min, 0) +
    COALESCE(ts.tiempo_desplazamiento_vuelta_min, 0)
  ), 0)                                                   AS min_total_desplazamiento,
  -- Eficiencia: % del tiempo en servicio efectivo vs tiempo total del turno
  CASE
    WHEN t.tiempo_total_min > 0 THEN
      ROUND(
        COALESCE(SUM(ts.tiempo_servicio_efectivo_min), 0)::NUMERIC
        / t.tiempo_total_min * 100, 1
      )
    ELSE 0
  END                                                     AS pct_eficiencia,
  -- Servicio activo (en curso)
  (
    SELECT row_to_json(sub) FROM (
      SELECT
        sv.id,
        sv.estado_servicio,
        ot.consecutivo AS ot_consecutivo,
        c.name AS empresa
      FROM turno_servicios sv
      LEFT JOIN ordenes_trabajo ot ON ot.id = sv.orden_trabajo_id
      LEFT JOIN companies c ON c.id = ot.empresa_id
      WHERE sv.turno_id = t.id AND sv.estado_servicio != 'COMPLETADO'
      LIMIT 1
    ) sub
  )                                                       AS servicio_activo,
  -- Aprobación
  t.aprobado_por,
  t.fecha_aprobacion,
  t.observaciones,
  t.created_at
FROM turnos_tecnicos     t
JOIN employees           e  ON e.id = t.empleado_id
LEFT JOIN turno_servicios ts ON ts.turno_id = t.id
GROUP BY t.id, e.id
ORDER BY t.fecha_turno DESC, e.full_name ASC;

-- ─────────────────────────────────────────────────────────────
-- 8. VISTA: calendario_laboral
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW calendario_laboral AS
SELECT
  fecha,
  nombre,
  tipo,
  EXTRACT(DOW FROM fecha)::INT AS dia_semana,
  CASE WHEN EXTRACT(DOW FROM fecha) = 0 THEN TRUE ELSE FALSE END AS es_domingo,
  TRUE AS es_festivo
FROM festivos_colombia
WHERE activo = TRUE
UNION ALL
-- Domingos del año actual y los 2 siguientes (que NO sean festivos)
SELECT
  gs::DATE                AS fecha,
  'Domingo'               AS nombre,
  'DOMINGO'               AS tipo,
  0                       AS dia_semana,
  TRUE                    AS es_domingo,
  FALSE                   AS es_festivo
FROM generate_series(
  DATE_TRUNC('year', CURRENT_DATE),
  DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '2 years',
  INTERVAL '1 day'
) gs
WHERE EXTRACT(DOW FROM gs) = 0
  AND gs::DATE NOT IN (
    SELECT fecha FROM festivos_colombia WHERE activo = TRUE
  );

-- ─────────────────────────────────────────────────────────────
-- 9. MÓDULO EN modulos_sistema + PERMISOS RBAC
-- ─────────────────────────────────────────────────────────────
INSERT INTO modulos_sistema (nombre, slug, icono, ruta_base, orden_menu)
VALUES ('Control de Turnos', 'turnos', 'Clock', '/turnos', 5)
ON CONFLICT (slug) DO NOTHING;

-- Permisos por rol
DO $$
DECLARE
  r_admin      UUID;
  r_supervisor UUID;
  r_tecnico    UUID;
  m_turnos     UUID;
BEGIN
  SELECT id INTO r_admin      FROM roles WHERE slug = 'admin';
  SELECT id INTO r_supervisor FROM roles WHERE slug = 'supervisor_mant';
  SELECT id INTO r_tecnico    FROM roles WHERE slug = 'tecnico';
  SELECT id INTO m_turnos     FROM modulos_sistema WHERE slug = 'turnos';

  IF m_turnos IS NULL THEN RETURN; END IF;

  -- Admin: acceso total
  INSERT INTO roles_permisos
    (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar)
  VALUES (r_admin, m_turnos, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT (rol_id, modulo_id) DO NOTHING;

  -- Supervisor: ver + editar + exportar + aprobar
  INSERT INTO roles_permisos
    (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_exportar, puede_aprobar)
  VALUES (r_supervisor, m_turnos, TRUE, FALSE, TRUE, TRUE, TRUE)
  ON CONFLICT (rol_id, modulo_id) DO NOTHING;

  -- Técnico: ver + crear (registrar sus propios eventos)
  INSERT INTO roles_permisos
    (rol_id, modulo_id, puede_ver, puede_crear)
  VALUES (r_tecnico, m_turnos, TRUE, TRUE)
  ON CONFLICT (rol_id, modulo_id) DO NOTHING;
END $$;
