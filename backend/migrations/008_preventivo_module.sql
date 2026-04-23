-- ============================================================
-- Migración 008: Mantenimiento Preventivo — Plantillas, Frecuencias
-- y Actividades con Snapshot por OT
-- ============================================================

-- 1. Catálogo maestro de frecuencias de mantenimiento preventivo
CREATE TABLE IF NOT EXISTS pm_frecuencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(50)  NOT NULL,
  horas           INT          NOT NULL,
  descripcion     TEXT,
  orden_display   INT          NOT NULL DEFAULT 0,
  version         INT          NOT NULL DEFAULT 1,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- 2. Actividades estándar asociadas a cada frecuencia
CREATE TABLE IF NOT EXISTS pm_actividades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frecuencia_id   UUID         NOT NULL REFERENCES pm_frecuencias(id) ON DELETE CASCADE,
  orden           INT          NOT NULL DEFAULT 0,
  nombre          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  requiere_firma  BOOLEAN      NOT NULL DEFAULT FALSE,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE
);

-- 3. Insumos/repuestos estándar por frecuencia (vinculados al inventario)
CREATE TABLE IF NOT EXISTS pm_insumos_plantilla (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frecuencia_id       UUID          NOT NULL REFERENCES pm_frecuencias(id) ON DELETE CASCADE,
  item_inventario_id  UUID          REFERENCES inventory_items(id) ON DELETE SET NULL,
  descripcion_display VARCHAR(255)  NOT NULL,
  cantidad_sugerida   DECIMAL(10,2) NOT NULL DEFAULT 0,
  unidad              VARCHAR(30)   NOT NULL DEFAULT 'unidad',
  es_obligatorio      BOOLEAN       NOT NULL DEFAULT FALSE,
  activo              BOOLEAN       NOT NULL DEFAULT TRUE
);

-- 4. Snapshot de actividades copiadas a una OT preventiva
--    (se copia al seleccionar frecuencia, preserva historial)
CREATE TABLE IF NOT EXISTS ot_pm_actividades (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id  UUID         NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  pm_actividad_id   UUID         REFERENCES pm_actividades(id) ON DELETE SET NULL,
  orden             INT          NOT NULL DEFAULT 0,
  nombre            VARCHAR(200) NOT NULL,
  descripcion       TEXT,
  estado            VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                      CHECK (estado IN ('PENDIENTE','EN_PROCESO','COMPLETADA','OMITIDA')),
  completada_por    UUID         REFERENCES employees(id) ON DELETE SET NULL,
  fecha_completado  TIMESTAMPTZ,
  observacion       TEXT
);

-- 5. Agregar columnas a ordenes_trabajo para vincular frecuencia PM
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS pm_frecuencia_id UUID REFERENCES pm_frecuencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS horometro_frecuencia INT;

-- 6. Agregar columnas a ot_repuestos_insumos para distinguir origen
ALTER TABLE ot_repuestos_insumos
  ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (origen IN ('MANUAL','PLANTILLA_PM')),
  ADD COLUMN IF NOT EXISTS pm_insumo_id UUID REFERENCES pm_insumos_plantilla(id) ON DELETE SET NULL;

-- ============================================================
-- ÍNDICES DE OPTIMIZACIÓN
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pm_actividades_frecuencia ON pm_actividades(frecuencia_id);
CREATE INDEX IF NOT EXISTS idx_pm_insumos_frecuencia ON pm_insumos_plantilla(frecuencia_id);
CREATE INDEX IF NOT EXISTS idx_ot_pm_actividades_ot ON ot_pm_actividades(orden_trabajo_id);
CREATE INDEX IF NOT EXISTS idx_ot_frecuencia ON ordenes_trabajo(pm_frecuencia_id);

-- ============================================================
-- DATOS INICIALES (SEEDS) — Frecuencias y Actividades
-- ============================================================

-- Frecuencia 250 horas
INSERT INTO pm_frecuencias (id, nombre, horas, descripcion, orden_display) VALUES
  ('a0000000-0000-0000-0000-000000000250',
   '250 horas', 250,
   'Mantenimiento preventivo básico cada 250 horas de horómetro. Incluye cambio de aceite, filtros principales y lubricación general.',
   1)
ON CONFLICT DO NOTHING;

-- Frecuencia 1250 horas
INSERT INTO pm_frecuencias (id, nombre, horas, descripcion, orden_display) VALUES
  ('a0000000-0000-0000-0000-000000001250',
   '1250 horas', 1250,
   'Mantenimiento preventivo intermedio cada 1250 horas. Incluye todo lo de 250h más aceite diferencial y aceite de caja.',
   2)
ON CONFLICT DO NOTHING;

-- Frecuencia 2500 horas
INSERT INTO pm_frecuencias (id, nombre, horas, descripcion, orden_display) VALUES
  ('a0000000-0000-0000-0000-000000002500',
   '2500 horas', 2500,
   'Mantenimiento preventivo mayor cada 2500 horas. Incluye todo lo de 1250h más revisión completa del tren de potencia.',
   3)
ON CONFLICT DO NOTHING;

-- Actividades de la frecuencia 250 horas
INSERT INTO pm_actividades (frecuencia_id, orden, nombre) VALUES
  ('a0000000-0000-0000-0000-000000000250', 1, 'ACEITE MOTOR'),
  ('a0000000-0000-0000-0000-000000000250', 2, 'FILTRO GLP'),
  ('a0000000-0000-0000-0000-000000000250', 3, 'FILTRO AIRE'),
  ('a0000000-0000-0000-0000-000000000250', 4, 'LUBRICANTE CADENA'),
  ('a0000000-0000-0000-0000-000000000250', 5, 'GRASA'),
  ('a0000000-0000-0000-0000-000000000250', 6, 'FILTRO COMBUSTIBLE'),
  ('a0000000-0000-0000-0000-000000000250', 7, 'FILTRO MOTOR'),
  ('a0000000-0000-0000-0000-000000000250', 8, 'FILTRO BOMBA GASOLINA'),
  ('a0000000-0000-0000-0000-000000000250', 9, 'MANO DE OBRA')
ON CONFLICT DO NOTHING;

-- Actividades de la frecuencia 2500 horas
INSERT INTO pm_actividades (frecuencia_id, orden, nombre) VALUES
  ('a0000000-0000-0000-0000-000000002500', 1, 'ACEITE MOTOR'),
  ('a0000000-0000-0000-0000-000000002500', 2, 'FILTRO GLP'),
  ('a0000000-0000-0000-0000-000000002500', 3, 'FILTRO AIRE'),
  ('a0000000-0000-0000-0000-000000002500', 4, 'LUBRICANTE CADENA'),
  ('a0000000-0000-0000-0000-000000002500', 5, 'GRASA'),
  ('a0000000-0000-0000-0000-000000002500', 6, 'FILTRO COMBUSTIBLE'),
  ('a0000000-0000-0000-0000-000000002500', 7, 'FILTRO MOTOR'),
  ('a0000000-0000-0000-0000-000000002500', 8, 'FILTRO BOMBA GASOLINA'),
  ('a0000000-0000-0000-0000-000000002500', 9, 'ACEITE DIFERENCIAL'),
  ('a0000000-0000-0000-0000-000000002500', 10, 'ACEITE CAJA'),
  ('a0000000-0000-0000-0000-000000002500', 11, 'MANO DE OBRA')
ON CONFLICT DO NOTHING;

-- Actividades de la frecuencia 1250 horas
INSERT INTO pm_actividades (frecuencia_id, orden, nombre) VALUES
  ('a0000000-0000-0000-0000-000000001250', 1, 'ACEITE MOTOR'),
  ('a0000000-0000-0000-0000-000000001250', 2, 'FILTRO MOTOR'),
  ('a0000000-0000-0000-0000-000000001250', 3, 'FILTRO AIRE'),
  ('a0000000-0000-0000-0000-000000001250', 4, 'LUBRICANTE CADENA'),
  ('a0000000-0000-0000-0000-000000001250', 5, 'GRASA'),
  ('a0000000-0000-0000-0000-000000001250', 6, 'FILTRO COMBUSTIBLE'),
  ('a0000000-0000-0000-0000-000000001250', 7, 'FILTRO GLP'),
  ('a0000000-0000-0000-0000-000000001250', 8, 'ACEITE DIFERENCIAL'),
  ('a0000000-0000-0000-0000-000000001250', 9, 'FILTRO BOMBA GASOLINA'),
  ('a0000000-0000-0000-0000-000000001250', 10, 'ACEITE CAJA'),
  ('a0000000-0000-0000-0000-000000001250', 11, 'MANO DE OBRA')
ON CONFLICT DO NOTHING;
