-- Migración 133: Módulo de Registro Simple de Compras e Historial de Precios
-- Desacopla el flujo burocrático de OC y permite registrar compras directas que alimentan inventario.

BEGIN;

CREATE TABLE IF NOT EXISTS compras_registro (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo       VARCHAR(50) UNIQUE,
  numero_factura    VARCHAR(100) NOT NULL,
  fecha_compra      DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor_id      UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  producto_id       UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
  cantidad          DECIMAL(12,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario   DECIMAL(15,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal          DECIMAL(15,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  iva_pct           DECIMAL(5,2) DEFAULT 0,
  iva_valor         DECIMAL(15,2) DEFAULT 0,
  total             DECIMAL(15,2) NOT NULL,
  observaciones     TEXT,
  registrado_por    VARCHAR(100),
  movimiento_id     UUID REFERENCES movimientos_inventario(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Secuencia para consecutivos COM-00001
CREATE SEQUENCE IF NOT EXISTS seq_compras_registro START 1;

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_compras_prod_fecha ON compras_registro (producto_id, fecha_compra DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras_registro (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras_registro (fecha_compra DESC);
CREATE INDEX IF NOT EXISTS idx_compras_factura ON compras_registro (numero_factura);

-- Migrar compras históricas desde oc_items recibidos
INSERT INTO compras_registro (
  consecutivo,
  numero_factura,
  fecha_compra,
  proveedor_id,
  producto_id,
  cantidad,
  precio_unitario,
  iva_pct,
  iva_valor,
  total,
  observaciones,
  created_at
)
SELECT 
  'HIST-' || o.consecutivo || '-' || oi.id::text,
  o.consecutivo,
  COALESCE(o.fecha_emision, o.created_at::date),
  o.proveedor_id,
  oi.item_inventario_id,
  oi.cantidad_recibida,
  oi.precio_unitario,
  COALESCE(oi.iva_pct, 0),
  COALESCE(oi.iva_valor, 0),
  COALESCE(oi.total_item, oi.cantidad_recibida * oi.precio_unitario),
  'Registro histórico migrado desde OC ' || o.consecutivo,
  o.created_at
FROM oc_items oi
JOIN ordenes_compra o ON o.id = oi.orden_compra_id
WHERE oi.item_inventario_id IS NOT NULL 
  AND oi.cantidad_recibida > 0
  AND o.estado IN ('RECIBIDA_TOTAL', 'RECIBIDA_PARCIAL', 'EMITIDA')
ON CONFLICT DO NOTHING;

-- Actualizar nombre legible del módulo en modulos_sistema sin cambiar el slug para preservar permisos RBAC
UPDATE modulos_sistema 
SET nombre = 'Compras', ruta_base = '/compras' 
WHERE slug = 'ordenes_compra';

COMMIT;
