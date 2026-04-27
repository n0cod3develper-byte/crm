-- ============================================================
-- Migración 012: Módulo de Facturación y Control de OTs Liquidadas
-- ============================================================

-- 1. Tabla: facturas
CREATE TABLE IF NOT EXISTS facturas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo_interno   VARCHAR(20) UNIQUE NOT NULL,
  numero_factura        VARCHAR(50) UNIQUE,
  empresa_id            UUID NOT NULL REFERENCES companies(id),
  estado                VARCHAR(30) NOT NULL DEFAULT 'PREFACTURA'
    CHECK (estado IN ('PREFACTURA', 'FACTURADA', 'ANULADA')),
  subtotal              DECIMAL(14,2) NOT NULL DEFAULT 0,
  iva_pct               DECIMAL(5,2)  NOT NULL DEFAULT 19,
  iva_valor             DECIMAL(14,2) NOT NULL DEFAULT 0,
  total                 DECIMAL(14,2) NOT NULL DEFAULT 0,
  fecha_prefactura      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_factura         DATE,
  fecha_vencimiento     DATE,
  condicion_pago        VARCHAR(50),
  notas                 TEXT,
  pdf_prefactura_path   VARCHAR(500),
  sistema_contable      VARCHAR(50),
  sistema_contable_id   VARCHAR(100),
  sistema_contable_sync BOOLEAN DEFAULT FALSE,
  sistema_contable_resp JSONB,
  creada_por            VARCHAR(100) NOT NULL,
  facturada_por         VARCHAR(100),
  anulada_por           VARCHAR(100),
  motivo_anulacion      TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facturas_empresa   ON facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado    ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha     ON facturas(fecha_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_nro       ON facturas(numero_factura);

-- 2. Secuencia para el consecutivo interno de facturas
INSERT INTO consecutivos (id, ultimo_valor) VALUES ('FAC', 0) ON CONFLICT DO NOTHING;

-- 3. Tabla: factura_ots
CREATE TABLE IF NOT EXISTS factura_ots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE RESTRICT,
  ot_id           UUID NOT NULL UNIQUE REFERENCES ordenes_trabajo(id),
  ot_consecutivo  VARCHAR(20) NOT NULL,
  subtotal_ot     DECIMAL(14,2) NOT NULL,
  iva_ot          DECIMAL(14,2) NOT NULL,
  total_ot        DECIMAL(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_factura_ots_factura ON factura_ots(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_ots_ot      ON factura_ots(ot_id);

-- 4. Modificación tabla: ordenes_trabajo
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_facturada TIMESTAMP;

-- Actualizar el constraint de estado de OTs
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_check;
ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_estado_check 
  CHECK (estado IN ('ABIERTA', 'EN_PROCESO', 'LIQUIDADA', 'CERRADA', 'FACTURADA', 'ANULADA_FACTURA'));

-- Índice para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_ot_estado_factura
  ON ordenes_trabajo(estado, factura_id)
  WHERE estado IN ('LIQUIDADA', 'FACTURADA');

-- 4.5 Modificación tabla: companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS condicion_pago VARCHAR(50);

-- 5. Vista: ots_pendientes_facturar
CREATE OR REPLACE VIEW ots_pendientes_facturar AS
SELECT
  ot.id,
  ot.consecutivo,
  ot.tipo_mantenimiento,
  ot.estado,
  ot.horometro_inicial,
  ot.horometro_final,
  e.id           AS empresa_id,
  e.name AS empresa_nombre,
  e.nit          AS empresa_nit,
  e.condicion_pago,
  liq.total_mano_obra,
  liq.total_repuestos,
  liq.subtotal,
  liq.impuesto_valor  AS iva_valor,
  liq.total_final     AS total,
  liq.fecha_liquidacion,
  EXTRACT(DAY FROM NOW() - liq.fecha_liquidacion)::INT AS dias_desde_liquidacion
FROM ordenes_trabajo ot
JOIN companies        e   ON e.id = ot.empresa_id
JOIN ot_liquidacion   liq ON liq.orden_trabajo_id = ot.id
WHERE ot.estado = 'LIQUIDADA'
  AND ot.factura_id IS NULL;

-- 6. Vista: resumen_cartera_por_empresa
CREATE OR REPLACE VIEW resumen_cartera_por_empresa AS
SELECT
  e.id             AS empresa_id,
  e.name,
  e.nit,
  COUNT(CASE WHEN ot.estado = 'LIQUIDADA'  THEN 1 END) AS ots_por_facturar,
  COUNT(CASE WHEN ot.estado = 'FACTURADA'  THEN 1 END) AS ots_facturadas,
  SUM(CASE WHEN ot.estado = 'LIQUIDADA'
    THEN liq.total_final ELSE 0 END)  AS valor_pendiente_facturar,
  SUM(CASE WHEN ot.estado = 'FACTURADA'
    THEN liq.total_final ELSE 0 END)  AS valor_facturado_total,
  MAX(liq.fecha_liquidacion)          AS ultima_liquidacion
FROM companies       e
JOIN ordenes_trabajo ot  ON ot.empresa_id = e.id
JOIN ot_liquidacion  liq ON liq.orden_trabajo_id = ot.id
WHERE ot.estado IN ('LIQUIDADA','FACTURADA')
GROUP BY e.id, e.name, e.nit;

-- 7. Roles y Permisos

-- Nuevo rol Facturador
INSERT INTO roles (nombre, slug, descripcion, es_sistema) VALUES
  ('Facturador', 'facturador', 'Gestiona prefacturas y registro de números de factura', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Nuevo módulo
INSERT INTO modulos_sistema
  (nombre, slug, icono, ruta_base, orden_menu, activo)
VALUES
  ('Facturación', 'facturacion', 'Receipt', '/facturacion', 9, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Permisos
DO $$
DECLARE
    r_admin UUID;
    r_facturador UUID;
    r_supervisor UUID;
    m_facturacion UUID;
    m_ot UUID;
    m_empresas UUID;
    m_reportes UUID;
BEGIN
    SELECT id INTO r_admin FROM roles WHERE slug = 'admin';
    SELECT id INTO r_facturador FROM roles WHERE slug = 'facturador';
    SELECT id INTO r_supervisor FROM roles WHERE slug = 'supervisor_mant';
    SELECT id INTO m_facturacion FROM modulos_sistema WHERE slug = 'facturacion';
    SELECT id INTO m_ot FROM modulos_sistema WHERE slug = 'ordenes_trabajo';
    SELECT id INTO m_empresas FROM modulos_sistema WHERE slug = 'empresas';
    SELECT id INTO m_reportes FROM modulos_sistema WHERE slug = 'reportes';

    -- Admin: todo en facturacion
    IF r_admin IS NOT NULL AND m_facturacion IS NOT NULL THEN
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
        VALUES (r_admin, m_facturacion, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Facturador: facturacion (ver, crear, editar, exportar)
    IF r_facturador IS NOT NULL AND m_facturacion IS NOT NULL THEN
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_exportar)
        VALUES (r_facturador, m_facturacion, TRUE, TRUE, TRUE, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Facturador: ver OT
    IF r_facturador IS NOT NULL AND m_ot IS NOT NULL THEN
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar)
        VALUES (r_facturador, m_ot, TRUE, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Facturador: ver Empresas
    IF r_facturador IS NOT NULL AND m_empresas IS NOT NULL THEN
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver)
        VALUES (r_facturador, m_empresas, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Facturador: ver Reportes
    IF r_facturador IS NOT NULL AND m_reportes IS NOT NULL THEN
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar)
        VALUES (r_facturador, m_reportes, TRUE, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Supervisor Mantenimiento: ver facturación (solo lectura)
    IF r_supervisor IS NOT NULL AND m_facturacion IS NOT NULL THEN
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver)
        VALUES (r_supervisor, m_facturacion, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

END $$;
