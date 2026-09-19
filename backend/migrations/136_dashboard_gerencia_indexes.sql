-- ============================================================
-- Migración 136: Índices compuestos para optimizar Dashboard Gerencial
-- ============================================================
-- Análisis de queries lentas (~240-280ms) y los índices que faltan:

-- 1. facturas(estado, fecha_factura) — cubre getIngresosDelMes y getTendenciaIngresosMensual
--    Query: WHERE estado = 'FACTURADA' AND fecha_factura >= ...
--    Los índices sueltos en (estado) y (fecha_factura) NO sirven para ambos filtros
CREATE INDEX IF NOT EXISTS idx_facturas_estado_fecha
  ON facturas(estado, fecha_factura)
  WHERE estado = 'FACTURADA';

-- 2. facturas(estado, fecha_vencimiento) — cubre getCarteraPorAntiguedad
--    Query: WHERE estado = 'FACTURADA' AND fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= ...
CREATE INDEX IF NOT EXISTS idx_facturas_estado_vencimiento
  ON facturas(estado, fecha_vencimiento)
  WHERE estado = 'FACTURADA' AND fecha_vencimiento IS NOT NULL;

-- 3. remisiones(fecha_servicio, estado, equipo_id) — cubre getUtilizacionFlota
--    Query: WHERE deleted_at IS NULL AND fecha_servicio = CURRENT_DATE AND estado NOT IN (...)
--    El índice suelto en (fecha_servicio) no incluye equipo_id para COVERING
CREATE INDEX IF NOT EXISTS idx_remisiones_fecha_estado_equipo
  ON remisiones(fecha_servicio, estado, equipo_id)
  WHERE deleted_at IS NULL;

-- 4. ot_liquidacion(orden_trabajo_id, fecha_liquidacion) — cubre getCostoMantenimientoMes
--    Query: JOIN ON ot.id = otl.orden_trabajo_id WHERE DATE_TRUNC('month', otl.fecha_liquidacion) = ...
--    El índice suelto en (fecha_liquidacion) no cubre el JOIN
CREATE INDEX IF NOT EXISTS idx_ot_liq_ot_fecha
  ON ot_liquidacion(orden_trabajo_id, fecha_liquidacion);

-- 5. remisiones(estado, factura_id) parcial para pendientes — cubre getRemisionesPendientes
--    Query: WHERE estado = 'LIQUIDADA' AND factura_id IS NULL AND deleted_at IS NULL
--    El idx_remisiones_estado_factura filtrado a ('LIQUIDADA','FACTURADA') no es óptimo para este caso
CREATE INDEX IF NOT EXISTS idx_remisiones_pendientes_facturar
  ON remisiones(estado, deleted_at, total_neto)
  WHERE estado = 'LIQUIDADA' AND factura_id IS NULL AND deleted_at IS NULL;
