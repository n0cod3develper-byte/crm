-- ============================================================
-- Migración 006: Módulo de Mantenimiento y Órdenes de Trabajo (OT)
-- ============================================================

-- 1. Modificar tabla employees para agregar tarifa por hora
ALTER TABLE employees ADD COLUMN hourly_rate DECIMAL(12,2) DEFAULT 0;

-- 2. Tabla para control de consecutivos
CREATE TABLE IF NOT EXISTS consecutivos (
  id VARCHAR(20) PRIMARY KEY, -- 'OT', 'CAR'
  ultimo_valor INT NOT NULL DEFAULT 0
);

-- Inicializar series
INSERT INTO consecutivos (id, ultimo_valor) VALUES ('OT', 0), ('CAR', 0) ON CONFLICT DO NOTHING;

-- 3. Tabla de Órdenes de Trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo        VARCHAR(20) UNIQUE NOT NULL,
  tipo_mantenimiento VARCHAR(20) NOT NULL CHECK (tipo_mantenimiento IN ('CORRECTIVO', 'PREVENTIVO')),
  empresa_id         UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  equipo_id          UUID NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  horometro_inicial    DECIMAL(10,1),
  horometro_final      DECIMAL(10,1),
  responsable        VARCHAR(150),
  contacto_empresa   VARCHAR(150),
  telefono_contacto  VARCHAR(30),
  detalle_servicio   TEXT,
  observaciones      TEXT,
  estado             VARCHAR(30) DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'EN_PROCESO', 'LIQUIDADA', 'CERRADA')),
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Técnicos asignados
CREATE TABLE IF NOT EXISTS ot_tecnicos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id   UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  empleado_id        UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  fecha_salida       DATE,
  hora_salida        TIME,
  fecha_regreso      DATE,
  hora_regreso       TIME,
  tiempo_total_min   INT,
  tarifa_hora        DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_mano_obra    DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- 5. Tabla de Repuestos e Insumos
CREATE TABLE IF NOT EXISTS ot_repuestos_insumos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id   UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  item_inventario_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  descripcion        VARCHAR(255) NOT NULL,
  cantidad           DECIMAL(10,2) NOT NULL,
  unidad             VARCHAR(20) NOT NULL,
  precio_unitario    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total              DECIMAL(12,2) NOT NULL DEFAULT 0,
  descargado         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_descargo     TIMESTAMPTZ
);

-- 6. Tabla de Liquidación
CREATE TABLE IF NOT EXISTS ot_liquidacion (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id   UUID NOT NULL UNIQUE REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  total_mano_obra    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_repuestos    DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
  impuesto_pct       DECIMAL(5,2) NOT NULL DEFAULT 19.00,
  impuesto_valor     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_final        DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_liquidacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  liquidado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
  notas_liquidacion  TEXT
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_ot_empresa ON ordenes_trabajo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ot_equipo ON ordenes_trabajo(equipo_id);
CREATE INDEX IF NOT EXISTS idx_ot_estado ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_ot_consecutivo ON ordenes_trabajo(consecutivo);
CREATE INDEX IF NOT EXISTS idx_ot_tecnicos_ot ON ot_tecnicos(orden_trabajo_id);
CREATE INDEX IF NOT EXISTS idx_ot_repuestos_ot ON ot_repuestos_insumos(orden_trabajo_id);
