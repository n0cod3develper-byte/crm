-- ============================================================
-- Migración 007: Módulo de Proveedores y Órdenes de Compra
-- Fecha: 2026-04-15
-- ============================================================

-- ============================================================
-- 1. TABLAS PARA CONFIGURACIÓN (Límites, Términos, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS compras_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave           VARCHAR(100) UNIQUE NOT NULL,
  valor           JSONB NOT NULL,
  descripcion     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Insertar configuración inicial por defecto
INSERT INTO compras_config (clave, valor, descripcion) VALUES
  ('aprobacion_limites', '{"nivel_1": 5000000, "nivel_2": 20000000}', 'Límites en COP para niveles de aprobación de Órdenes de Compra'),
  ('terminos_oc', '{"texto": "1. El proveedor debe adjuntar factura electrónica respetando las resoluciones de la DIAN.\n2. La mercancía debe entregarse en horario hábil.\n3. Recepción sujeta a verificación de calidad."}', 'Términos y condiciones por defecto para impresiones en PDF de las OC'),
  ('condiciones_pago', '["CONTADO", "15_DIAS", "30_DIAS", "45_DIAS", "60_DIAS", "90_DIAS", "CREDITO_ESPECIAL"]', 'Condiciones de pago disponibles')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- 2. PROVEEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "tipo_proveedor" se manejará como text array para simplificar en vez de ENUM, pero validados en backend
  tipo_proveedor         TEXT[] NOT NULL,
  razon_social           VARCHAR(200) NOT NULL,
  nombre_comercial       VARCHAR(200),
  tipo_documento         VARCHAR(20) NOT NULL CHECK (tipo_documento IN ('NIT', 'CC', 'CE', 'PASAPORTE', 'RUT')),
  numero_documento       VARCHAR(20) UNIQUE NOT NULL,
  digito_verificacion    CHAR(1),
  regimen_tributario     VARCHAR(50) NOT NULL CHECK (regimen_tributario IN ('RESPONSABLE_IVA', 'NO_RESPONSABLE', 'GRAN_CONTRIBUYENTE', 'REGIMEN_SIMPLE')),
  aplica_iva             BOOLEAN DEFAULT TRUE,
  tarifa_iva             DECIMAL(5,2) DEFAULT 19.00,
  pais                   VARCHAR(80) DEFAULT 'Colombia',
  departamento           VARCHAR(80),
  ciudad                 VARCHAR(80),
  direccion              VARCHAR(255),
  telefono_principal     VARCHAR(30) NOT NULL,
  telefono_secundario    VARCHAR(30),
  email_principal        VARCHAR(150) NOT NULL,
  email_facturacion      VARCHAR(150),
  sitio_web              VARCHAR(200),
  contacto_nombre        VARCHAR(150),
  contacto_cargo         VARCHAR(100),
  contacto_telefono      VARCHAR(30),
  contacto_email         VARCHAR(150),
  condicion_pago         VARCHAR(30) DEFAULT '30_DIAS' CHECK (condicion_pago IN ('CONTADO', '15_DIAS', '30_DIAS', '45_DIAS', '60_DIAS', '90_DIAS', 'CREDITO_ESPECIAL')),
  dias_entrega_promedio  INT DEFAULT 0,
  moneda                 VARCHAR(3) DEFAULT 'COP' CHECK (moneda IN ('COP', 'USD', 'EUR')),
  cuenta_bancaria_banco  VARCHAR(100),
  cuenta_bancaria_tipo   VARCHAR(20) CHECK (cuenta_bancaria_tipo IN ('CORRIENTE', 'AHORROS')),
  cuenta_bancaria_numero VARCHAR(50),
  cuenta_bancaria_titular VARCHAR(150),
  calificacion           DECIMAL(3,1) DEFAULT 0.0,
  estado                 VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO', 'EN_EVALUACION')),
  notas_internas         TEXT,
  documentos_adjuntos    JSONB DEFAULT '[]'::jsonb,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  created_by             UUID REFERENCES users(id) ON DELETE SET NULL, -- references users, as there's no explicitly implemented "empleado" auth module separated from users table
  deleted_at             TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS proveedor_categorias_productos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id   UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  categoria      VARCHAR(100) NOT NULL,
  descripcion    TEXT
);

CREATE INDEX IF NOT EXISTS idx_proveedores_numero_doc ON proveedores(numero_documento);
CREATE INDEX IF NOT EXISTS idx_proveedores_razon ON proveedores(razon_social);

-- ============================================================
-- 3. SOLICITUDES DE COMPRA
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes_compra (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo      VARCHAR(20) UNIQUE NOT NULL,
  solicitante_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  area_solicitante VARCHAR(100),
  fecha_requerida  DATE NOT NULL,
  prioridad        VARCHAR(20) DEFAULT 'MEDIA' CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
  estado           VARCHAR(30) DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'ENVIADA', 'EN_COTIZACION', 'APROBADA', 'OC_GENERADA', 'RECHAZADA')),
  justificacion    TEXT,
  notas            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitud_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id        UUID NOT NULL REFERENCES solicitudes_compra(id) ON DELETE CASCADE,
  item_inventario_id  UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  descripcion         VARCHAR(255) NOT NULL,
  unidad              VARCHAR(30) NOT NULL,
  cantidad_solicitada DECIMAL(10,2) NOT NULL,
  cantidad_aprobada   DECIMAL(10,2),
  notas_item          TEXT
);

-- Secuencia para Consecutivos de Solicitudes
CREATE SEQUENCE IF NOT EXISTS seq_solicitudes_compra START 1;

-- ============================================================
-- 4. COTIZACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS cotizaciones (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo          VARCHAR(20) UNIQUE NOT NULL,
  solicitud_id         UUID NOT NULL REFERENCES solicitudes_compra(id) ON DELETE CASCADE,
  proveedor_id         UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha_cotizacion     DATE NOT NULL,
  fecha_vencimiento    DATE NOT NULL,
  numero_ref_proveedor VARCHAR(50),
  condicion_pago       VARCHAR(30) CHECK (condicion_pago IN ('CONTADO', '15_DIAS', '30_DIAS', '45_DIAS', '60_DIAS', '90_DIAS', 'CREDITO_ESPECIAL')),
  dias_entrega         INT,
  moneda               VARCHAR(3) DEFAULT 'COP',
  subtotal             DECIMAL(15,2) DEFAULT 0,
  iva_valor            DECIMAL(15,2) DEFAULT 0,
  total                DECIMAL(15,2) DEFAULT 0,
  estado               VARCHAR(30) DEFAULT 'RECIBIDA' CHECK (estado IN ('RECIBIDA', 'SELECCIONADA', 'RECHAZADA')),
  notas                TEXT,
  archivo_adjunto      VARCHAR(300),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cotizacion_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id       UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  solicitud_item_id   UUID NOT NULL REFERENCES solicitud_items(id) ON DELETE CASCADE,
  descripcion         VARCHAR(255) NOT NULL,
  cantidad            DECIMAL(10,2) NOT NULL,
  precio_unitario     DECIMAL(15,2) NOT NULL,
  aplica_iva          BOOLEAN DEFAULT TRUE,
  iva_pct             DECIMAL(5,2) DEFAULT 19.00,
  iva_valor           DECIMAL(15,2) DEFAULT 0,
  total_item          DECIMAL(15,2) DEFAULT 0,
  marca               VARCHAR(100),
  referencia          VARCHAR(100),
  tiempo_entrega_dias INT
);

CREATE SEQUENCE IF NOT EXISTS seq_cotizaciones START 1;

-- ============================================================
-- 5. ÓRDENES DE COMPRA
-- ============================================================
CREATE TABLE IF NOT EXISTS ordenes_compra (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo            VARCHAR(20) UNIQUE NOT NULL,
  solicitud_id           UUID REFERENCES solicitudes_compra(id) ON DELETE SET NULL,
  cotizacion_id          UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  proveedor_id           UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha_emision          DATE,
  fecha_entrega_esperada DATE,
  condicion_pago         VARCHAR(30),
  direccion_entrega      VARCHAR(255),
  contacto_recepcion     VARCHAR(150),
  subtotal               DECIMAL(15,2) DEFAULT 0,
  iva_valor              DECIMAL(15,2) DEFAULT 0,
  total                  DECIMAL(15,2) DEFAULT 0,
  estado                 VARCHAR(30) DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'EN_APROBACION', 'APROBADA', 'EMITIDA', 'RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'ANULADA')),
  notas                  TEXT,
  terminos_condiciones   TEXT,
  created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oc_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id     UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  item_inventario_id  UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  descripcion         VARCHAR(255) NOT NULL,
  unidad              VARCHAR(30) NOT NULL,
  cantidad_ordenada   DECIMAL(10,2) NOT NULL,
  cantidad_recibida   DECIMAL(10,2) DEFAULT 0,
  precio_unitario     DECIMAL(15,2) NOT NULL,
  aplica_iva          BOOLEAN DEFAULT TRUE,
  iva_pct             DECIMAL(5,2) DEFAULT 19.00,
  iva_valor           DECIMAL(15,2) DEFAULT 0,
  total_item          DECIMAL(15,2) DEFAULT 0,
  marca               VARCHAR(100),
  referencia          VARCHAR(100),
  estado_item         VARCHAR(30) DEFAULT 'PENDIENTE' CHECK (estado_item IN ('PENDIENTE', 'RECIBIDO_PARCIAL', 'RECIBIDO_TOTAL'))
);

CREATE SEQUENCE IF NOT EXISTS seq_ordenes_compra START 1;

-- ============================================================
-- 6. APROBACIONES DE OC
-- ============================================================
CREATE TABLE IF NOT EXISTS aprobaciones_oc (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo     VARCHAR(30) DEFAULT 'ORDEN_COMPRA' CHECK (entidad_tipo IN ('SOLICITUD', 'ORDEN_COMPRA')),
  entidad_id       UUID NOT NULL, -- UUID manual references logic
  nivel            INT NOT NULL,
  aprobador_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  estado           VARCHAR(30) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  fecha_accion     TIMESTAMPTZ,
  comentario       TEXT,
  monto_limite     DECIMAL(15,2),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  
  -- Para verificar que se aplique correctamente al modelo polimórfico
  CONSTRAINT fk_aprobaciones_orden_compra FOREIGN KEY (entidad_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aprobaciones_entidad ON aprobaciones_oc(entidad_id);
