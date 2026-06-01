-- ============================================================
-- Migracion 043: Campos para Activos de Sistemas (IT Asset Management)
-- Estos campos aplican cuando inventario.area = 'SISTEMAS'
-- ============================================================

BEGIN;

-- ============================================================
-- Modulo 1: Informacion General del Activo
-- ============================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS codigo_activo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_activo VARCHAR(30)
    CHECK (tipo_activo IN (
      'LAPTOP', 'DESKTOP', 'SERVIDOR', 'SWITCH', 'ROUTER',
      'FIREWALL', 'ACCESS_POINT', 'IMPRESORA', 'CAMARA',
      'UPS', 'MONITOR', 'OTRO'
    ));

-- ============================================================
-- Modulo 2: Especificaciones Tecnicas - Hardware
-- ============================================================
ALTER TABLE inventario
  -- Subgrupo A: Laptop, Desktop, Servidor
  ADD COLUMN IF NOT EXISTS cpu VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ram VARCHAR(50),
  ADD COLUMN IF NOT EXISTS almacenamiento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gpu VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cargador_info VARCHAR(200),

  -- Subgrupo B: Switch, Router, Firewall, Access Point
  ADD COLUMN IF NOT EXISTS cantidad_puertos INTEGER,
  ADD COLUMN IF NOT EXISTS velocidad_puertos VARCHAR(50),
  ADD COLUMN IF NOT EXISTS capa_operacion VARCHAR(10)
    CHECK (capa_operacion IS NULL OR capa_operacion IN ('CAPA_2', 'CAPA_3')),
  ADD COLUMN IF NOT EXISTS poe BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS poe_watts DECIMAL(6,2);

-- ============================================================
-- Modulo 3: Informacion de Red y Conectividad
-- ============================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS mac_lan VARCHAR(17),
  ADD COLUMN IF NOT EXISTS mac_wifi VARCHAR(17),
  ADD COLUMN IF NOT EXISTS direccion_ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS tipo_ip VARCHAR(10)
    CHECK (tipo_ip IS NULL OR tipo_ip IN ('FIJA', 'DHCP')),
  ADD COLUMN IF NOT EXISTS hostname VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vlan VARCHAR(50);

-- ============================================================
-- Modulo 4: Software y Sistema Operativo
-- ============================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS sistema_operativo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS licencia_so_key VARCHAR(200),
  ADD COLUMN IF NOT EXISTS software_critico JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- Modulo 5: Asignacion, Ubicacion y Responsabilidad
-- ============================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS documento_empleado VARCHAR(20),
  ADD COLUMN IF NOT EXISTS departamento_area VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ubicacion_fisica_detalle VARCHAR(255),
  ADD COLUMN IF NOT EXISTS fecha_asignacion DATE;

-- ============================================================
-- Modulo 6: Informacion Comercial, Financiera y Garantias
-- ============================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS factura_oc VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fecha_compra DATE,
  ADD COLUMN IF NOT EXISTS costo_adquisicion DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS fin_garantia DATE,
  ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20)
    CHECK (modalidad IS NULL OR modalidad IN ('PROPIA', 'ARRENDAMIENTO'));

-- ============================================================
-- Modulo 7: Historial y Observaciones
-- ============================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS historial_mantenimientos TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- ============================================================
-- Indices para los campos mas consultados
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventario_tipo_activo    ON inventario (tipo_activo);
CREATE INDEX IF NOT EXISTS idx_inventario_numero_serie   ON inventario (numero_serie);
CREATE INDEX IF NOT EXISTS idx_inventario_codigo_activo  ON inventario (codigo_activo);
CREATE INDEX IF NOT EXISTS idx_inventario_hostname       ON inventario (hostname);

COMMIT;
