
-- MIGRACIÓN 019: Upgrade Módulo de Movimientos de Inventario
-- Corrección de nombres de tablas y agregado de campos de auditoría y costos

BEGIN;

-- 1. Renombrar tablas existentes para mayor profesionalismo (Español)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    ALTER TABLE inventory_items RENAME TO inventario;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
    ALTER TABLE inventory_movements RENAME TO movimientos_inventario;
  END IF;
END $$;

-- 2. Renombrar columnas en tabla inventario
ALTER TABLE inventario 
  RENAME COLUMN stock_current TO stock_actual;
ALTER TABLE inventario 
  RENAME COLUMN unit_cost TO costo_reposicion; -- El costo promedio será costo_promedio_ponderado
ALTER TABLE inventario 
  ADD COLUMN IF NOT EXISTS costo_promedio_ponderado DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_piso DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_venta_sugerido DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_costo TIMESTAMP;

-- Migrar datos de columnas existentes si existen
UPDATE inventario SET costo_promedio_ponderado = unit_price * 0.7 WHERE costo_promedio_ponderado = 0; -- Valor inicial estimado
UPDATE inventario SET precio_piso = unit_price * 0.9 WHERE precio_piso = 0;
UPDATE inventario SET precio_venta_sugerido = unit_price WHERE precio_venta_sugerido = 0;

-- 3. Actualizar movimientos_inventario
ALTER TABLE movimientos_inventario
  RENAME COLUMN quantity TO cantidad;
ALTER TABLE movimientos_inventario
  RENAME COLUMN notes TO notas;
ALTER TABLE movimientos_inventario
  RENAME COLUMN item_id TO inventario_id;
ALTER TABLE movimientos_inventario
  RENAME COLUMN type TO tipo_legacy; -- Mantenemos temporalmente para mapeo
ALTER TABLE movimientos_inventario
  RENAME COLUMN created_by TO registrado_por_legacy;

-- Agregar campos faltantes según requerimiento
ALTER TABLE movimientos_inventario
  ADD COLUMN IF NOT EXISTS tipo_movimiento VARCHAR(30)
    CHECK (tipo_movimiento IN (
      'ENTRADA_COMPRA', 'ENTRADA_OC', 'ENTRADA_DEVOLUCION', 'ENTRADA_AJUSTE',
      'SALIDA_OT', 'SALIDA_AJUSTE', 'SALIDA_DEVOLUCION',
      'TRASLADO_ENTRADA', 'TRASLADO_SALIDA'
    )),
  ADD COLUMN IF NOT EXISTS precio_unitario    DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS subtotal           DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS iva_pct            DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_valor          DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_con_iva      DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS costo_promedio_antes  DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS costo_promedio_despues DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS stock_antes           DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS stock_despues         DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS proveedor_id       UUID REFERENCES proveedores(id),
  ADD COLUMN IF NOT EXISTS proveedor_nombre   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS numero_documento   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_documento     VARCHAR(30) DEFAULT 'FACTURA'
    CHECK (tipo_documento IN (
      'FACTURA', 'REMISION', 'NOTA_DEBITO', 'NOTA_CREDITO',
      'AJUSTE_INTERNO', 'ORDEN_COMPRA', 'SIN_DOCUMENTO'
    )),
  ADD COLUMN IF NOT EXISTS fecha_documento    DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS oc_id              UUID, -- Referencias si existen las tablas
  ADD COLUMN IF NOT EXISTS ot_id              UUID,
  ADD COLUMN IF NOT EXISTS ubicacion_id       UUID REFERENCES ubicaciones_bodega(id),
  ADD COLUMN IF NOT EXISTS registrado_por     VARCHAR(100), -- ID de Clerk
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMP DEFAULT NOW();

-- Mapear tipos legacy a nuevos tipos
UPDATE movimientos_inventario
SET tipo_movimiento = CASE
  WHEN tipo_legacy = 'in' THEN 'ENTRADA_COMPRA'
  WHEN tipo_legacy = 'out' THEN 'SALIDA_OT'
  WHEN tipo_legacy = 'adjustment' THEN 'ENTRADA_AJUSTE'
  ELSE 'ENTRADA_COMPRA'
END
WHERE tipo_movimiento IS NULL;

-- Mapear numero_factura desde reference si parece una factura
UPDATE movimientos_inventario
SET numero_documento = reference
WHERE numero_documento IS NULL AND reference IS NOT NULL;

-- 4. Crear Vista Historial Completo
CREATE OR REPLACE VIEW historial_movimientos_completo AS
SELECT
  m.id,
  m.tipo_movimiento,
  m.tipo_documento,
  m.numero_documento,
  m.fecha_documento,
  i.id              AS producto_id,
  i.codigo_interno  AS producto_codigo,
  i.name            AS producto_nombre,
  i.nombre_comercial,
  c.nombre          AS familia_nombre,
  u.abreviatura     AS unidad,
  m.cantidad,
  m.precio_unitario,
  m.subtotal,
  m.iva_pct,
  m.iva_valor,
  m.total_con_iva,
  m.stock_antes,
  m.stock_despues,
  m.costo_promedio_antes,
  m.costo_promedio_despues,
  m.proveedor_id,
  COALESCE(m.proveedor_nombre, p.razon_social) AS proveedor,
  m.oc_id,
  m.ot_id,
  CASE m.tipo_movimiento
    WHEN 'ENTRADA_COMPRA'     THEN 'Compra directa'
    WHEN 'ENTRADA_OC'         THEN 'Recepción OC'
    WHEN 'ENTRADA_DEVOLUCION' THEN 'Devolución entrada'
    WHEN 'ENTRADA_AJUSTE'     THEN 'Ajuste positivo'
    WHEN 'SALIDA_OT'          THEN 'Consumo en OT'
    WHEN 'SALIDA_AJUSTE'      THEN 'Ajuste negativo'
    WHEN 'SALIDA_DEVOLUCION'  THEN 'Devolución a proveedor'
    WHEN 'TRASLADO_ENTRADA'   THEN 'Traslado entrada'
    WHEN 'TRASLADO_SALIDA'    THEN 'Traslado salida'
  END AS tipo_label,
  CASE
    WHEN m.tipo_movimiento LIKE 'ENTRADA%'  THEN '+'
    WHEN m.tipo_movimiento LIKE 'SALIDA%'   THEN '-'
    WHEN m.tipo_movimiento = 'TRASLADO_ENTRADA' THEN '+'
    WHEN m.tipo_movimiento = 'TRASLADO_SALIDA'  THEN '-'
  END AS signo,
  m.notas,
  m.registrado_por,
  m.created_at
FROM movimientos_inventario   m
JOIN inventario               i ON i.id = m.inventario_id
LEFT JOIN catalogo_categorias c ON c.id = i.categoria_id
LEFT JOIN unidades_medida     u ON u.id = i.unidad_medida_id
LEFT JOIN proveedores         p ON p.id = m.proveedor_id;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_mov_inventario_producto ON movimientos_inventario(inventario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_inventario_tipo ON movimientos_inventario(tipo_movimiento);

COMMIT;
