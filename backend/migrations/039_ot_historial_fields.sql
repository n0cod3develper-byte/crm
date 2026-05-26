-- 039_ot_historial_fields.sql
-- Agrega a ordenes_trabajo los campos de historial de equipo
-- para que toda la info de mantenimiento se capture desde la OT.

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS fallas_encontradas         TEXT,
  ADD COLUMN IF NOT EXISTS nivel_criticidad           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS causa_raiz                 TEXT,
  ADD COLUMN IF NOT EXISTS trabajos_detalle           JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS observaciones_seguridad    TEXT,
  ADD COLUMN IF NOT EXISTS repuestos_mantenimiento    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fecha_hora_ingreso_taller  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_hora_salida_taller   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_inicio_bodega        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_fin_bodega           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado_equipo_al_cierre    VARCHAR(40),
  ADD COLUMN IF NOT EXISTS proxima_fecha_mantenimiento DATE,
  ADD COLUMN IF NOT EXISTS costo_total_mantenimiento  DECIMAL(14,2);
