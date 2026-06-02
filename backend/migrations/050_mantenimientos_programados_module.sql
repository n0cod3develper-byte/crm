-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 050: Módulo de Programación de Mantenimientos (mp_*)
-- ═══════════════════════════════════════════════════════════════════
-- Nota: equipos.id, users.id e inventario.id son tipo UUID.
-- areas_inventario.id es SERIAL (creada aquí).
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS areas_inventario (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(200) NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- 1.1 Planes de Mantenimiento
CREATE TABLE IF NOT EXISTS mp_planes_mantenimiento (
  id                      SERIAL PRIMARY KEY,
  codigo                  VARCHAR(20) UNIQUE NOT NULL,
  nombre                  VARCHAR(200) NOT NULL,
  descripcion             TEXT,
  tipo_entidad            VARCHAR(20) NOT NULL CHECK (tipo_entidad IN ('EQUIPO', 'AREA')),
  equipo_id               UUID REFERENCES equipos(id) ON DELETE SET NULL,
  area_id                 INTEGER REFERENCES areas_inventario(id) ON DELETE SET NULL,
  tipo_mantenimiento      VARCHAR(20) NOT NULL CHECK (tipo_mantenimiento IN ('PREVENTIVO','CORRECTIVO','PREDICTIVO','INSPECCION')),
  frecuencia_tipo         VARCHAR(20) NOT NULL CHECK (frecuencia_tipo IN ('DIAS','SEMANAS','MESES','HORAS','MANUAL')),
  frecuencia_valor        INTEGER,
  duracion_estimada_horas DECIMAL(5,2),
  prioridad               VARCHAR(10) NOT NULL DEFAULT 'MEDIA' CHECK (prioridad IN ('CRITICA','ALTA','MEDIA','BAJA')),
  responsable_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  activo                  BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio_vigencia   DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin_vigencia      DATE,
  observaciones           TEXT,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW(),
  created_by              UUID REFERENCES users(id),
  CONSTRAINT chk_mp_entidad CHECK (
    (tipo_entidad = 'EQUIPO' AND equipo_id IS NOT NULL AND area_id IS NULL) OR
    (tipo_entidad = 'AREA'   AND area_id  IS NOT NULL AND equipo_id IS NULL)
  )
);

-- 1.2 Actividades del Plan
CREATE TABLE IF NOT EXISTS mp_actividades_plan (
  id                  SERIAL PRIMARY KEY,
  plan_id             INTEGER NOT NULL REFERENCES mp_planes_mantenimiento(id) ON DELETE CASCADE,
  orden               SMALLINT NOT NULL DEFAULT 1,
  descripcion         VARCHAR(500) NOT NULL,
  obligatoria         BOOLEAN NOT NULL DEFAULT TRUE,
  tiempo_estimado_min INTEGER,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- 1.3 Insumos del Plan
CREATE TABLE IF NOT EXISTS mp_insumos_plan (
  id               SERIAL PRIMARY KEY,
  plan_id          INTEGER NOT NULL REFERENCES mp_planes_mantenimiento(id) ON DELETE CASCADE,
  producto_id      UUID REFERENCES inventario(id) ON DELETE SET NULL,
  descripcion_libre VARCHAR(200),
  cantidad         DECIMAL(10,3) NOT NULL,
  unidad           VARCHAR(50),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- 1.4 Ordenes de Mantenimiento
CREATE TABLE IF NOT EXISTS mp_ordenes_mantenimiento (
  id                   SERIAL PRIMARY KEY,
  codigo               VARCHAR(25) UNIQUE NOT NULL,
  plan_id              INTEGER REFERENCES mp_planes_mantenimiento(id) ON DELETE SET NULL,
  tipo_entidad         VARCHAR(20) NOT NULL CHECK (tipo_entidad IN ('EQUIPO','AREA')),
  equipo_id            UUID REFERENCES equipos(id) ON DELETE SET NULL,
  area_id              INTEGER REFERENCES areas_inventario(id) ON DELETE SET NULL,
  tipo_mantenimiento   VARCHAR(20) NOT NULL CHECK (tipo_mantenimiento IN ('PREVENTIVO','CORRECTIVO','PREDICTIVO','INSPECCION')),
  estado               VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADO' CHECK (estado IN ('PROGRAMADO','EN_EJECUCION','COMPLETADO','VERIFICADO','CANCELADO','POSPUESTO')),
  prioridad            VARCHAR(10) NOT NULL DEFAULT 'MEDIA' CHECK (prioridad IN ('CRITICA','ALTA','MEDIA','BAJA')),
  titulo               VARCHAR(200) NOT NULL,
  descripcion          TEXT,
  fecha_programada     DATE NOT NULL,
  fecha_inicio_real    TIMESTAMP,
  fecha_fin_real       TIMESTAMP,
  duracion_real_horas  DECIMAL(5,2),
  horometro_inicio     DECIMAL(10,2),
  horometro_fin        DECIMAL(10,2),
  responsable_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  ejecutado_por        VARCHAR(200),
  costo_mano_obra      DECIMAL(12,2),
  costo_insumos        DECIMAL(12,2),
  costo_total          DECIMAL(12,2) GENERATED ALWAYS AS (COALESCE(costo_mano_obra,0) + COALESCE(costo_insumos,0)) STORED,
  observaciones        TEXT,
  requiere_paro        BOOLEAN NOT NULL DEFAULT FALSE,
  orden_trabajo_id     INTEGER,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  created_by           UUID REFERENCES users(id),
  CONSTRAINT chk_mp_orden_entidad CHECK (
    (tipo_entidad = 'EQUIPO' AND equipo_id IS NOT NULL AND area_id IS NULL) OR
    (tipo_entidad = 'AREA'   AND area_id  IS NOT NULL AND equipo_id IS NULL)
  )
);

-- 1.5 Actividades de la Orden
CREATE TABLE IF NOT EXISTS mp_actividades_orden (
  id                SERIAL PRIMARY KEY,
  orden_id          INTEGER NOT NULL REFERENCES mp_ordenes_mantenimiento(id) ON DELETE CASCADE,
  actividad_plan_id INTEGER REFERENCES mp_actividades_plan(id) ON DELETE SET NULL,
  orden             SMALLINT NOT NULL DEFAULT 1,
  descripcion       VARCHAR(500) NOT NULL,
  obligatoria       BOOLEAN NOT NULL DEFAULT TRUE,
  completada        BOOLEAN NOT NULL DEFAULT FALSE,
  completada_at     TIMESTAMP,
  completada_por    UUID REFERENCES users(id),
  observacion       TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- 1.6 Insumos de la Orden
CREATE TABLE IF NOT EXISTS mp_insumos_orden (
  id                      SERIAL PRIMARY KEY,
  orden_id                INTEGER NOT NULL REFERENCES mp_ordenes_mantenimiento(id) ON DELETE CASCADE,
  producto_id             UUID REFERENCES inventario(id) ON DELETE SET NULL,
  descripcion_libre       VARCHAR(200),
  cantidad_planificada    DECIMAL(10,3),
  cantidad_usada          DECIMAL(10,3),
  unidad                  VARCHAR(50),
  costo_unitario          DECIMAL(12,2),
  movimiento_inventario_id INTEGER,
  created_at              TIMESTAMP DEFAULT NOW()
);

-- 1.7 Evidencias
CREATE TABLE IF NOT EXISTS mp_evidencias (
  id             SERIAL PRIMARY KEY,
  orden_id       INTEGER NOT NULL REFERENCES mp_ordenes_mantenimiento(id) ON DELETE CASCADE,
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta_archivo   VARCHAR(500) NOT NULL,
  tipo_mime      VARCHAR(100),
  tamano_bytes   INTEGER,
  descripcion    TEXT,
  uploaded_by    UUID REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT NOW()
);

-- 1.8 Bitacora
CREATE TABLE IF NOT EXISTS mp_bitacora (
  id              SERIAL PRIMARY KEY,
  orden_id        INTEGER NOT NULL REFERENCES mp_ordenes_mantenimiento(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(20),
  estado_nuevo    VARCHAR(20),
  comentario      TEXT,
  usuario_id      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 2. Secuencias
CREATE SEQUENCE IF NOT EXISTS mp_planes_seq START 1;
CREATE SEQUENCE IF NOT EXISTS mp_ordenes_seq START 1;

-- 3. Funciones y Triggers
CREATE OR REPLACE FUNCTION mp_generar_codigo_plan()
RETURNS TRIGGER AS $$ BEGIN NEW.codigo := 'PM-' || LPAD(nextval('mp_planes_seq')::TEXT, 5, '0'); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_codigo_plan ON mp_planes_mantenimiento;
CREATE TRIGGER trg_codigo_plan BEFORE INSERT ON mp_planes_mantenimiento FOR EACH ROW WHEN (NEW.codigo IS NULL) EXECUTE FUNCTION mp_generar_codigo_plan();

CREATE OR REPLACE FUNCTION mp_generar_codigo_orden()
RETURNS TRIGGER AS $$ BEGIN NEW.codigo := 'OMP-' || LPAD(nextval('mp_ordenes_seq')::TEXT, 5, '0'); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_codigo_orden ON mp_ordenes_mantenimiento;
CREATE TRIGGER trg_codigo_orden BEFORE INSERT ON mp_ordenes_mantenimiento FOR EACH ROW WHEN (NEW.codigo IS NULL) EXECUTE FUNCTION mp_generar_codigo_orden();

CREATE OR REPLACE FUNCTION update_mp_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_updated_plan ON mp_planes_mantenimiento;
CREATE TRIGGER trg_updated_plan BEFORE UPDATE ON mp_planes_mantenimiento FOR EACH ROW EXECUTE FUNCTION update_mp_timestamp();

DROP TRIGGER IF EXISTS trg_updated_orden ON mp_ordenes_mantenimiento;
CREATE TRIGGER trg_updated_orden BEFORE UPDATE ON mp_ordenes_mantenimiento FOR EACH ROW EXECUTE FUNCTION update_mp_timestamp();

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_mp_planes_equipo  ON mp_planes_mantenimiento(equipo_id);
CREATE INDEX IF NOT EXISTS idx_mp_planes_area    ON mp_planes_mantenimiento(area_id);
CREATE INDEX IF NOT EXISTS idx_mp_ordenes_fecha  ON mp_ordenes_mantenimiento(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_mp_ordenes_estado ON mp_ordenes_mantenimiento(estado);
CREATE INDEX IF NOT EXISTS idx_mp_ordenes_equipo ON mp_ordenes_mantenimiento(equipo_id);
CREATE INDEX IF NOT EXISTS idx_mp_ordenes_area   ON mp_ordenes_mantenimiento(area_id);
CREATE INDEX IF NOT EXISTS idx_mp_bitacora_orden ON mp_bitacora(orden_id);
CREATE INDEX IF NOT EXISTS idx_mp_actividades_orden_orden ON mp_actividades_orden(orden_id);
CREATE INDEX IF NOT EXISTS idx_mp_insumos_orden_orden     ON mp_insumos_orden(orden_id);
CREATE INDEX IF NOT EXISTS idx_mp_evidencias_orden        ON mp_evidencias(orden_id);

COMMIT;
