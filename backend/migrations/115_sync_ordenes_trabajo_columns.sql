-- Migración para añadir columnas faltantes en ordenes_trabajo
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS fecha_hora_ingreso_taller TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_hora_salida_taller TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_inicio_bodega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_fin_bodega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado_equipo_al_cierre VARCHAR(50),
  ADD COLUMN IF NOT EXISTS proxima_fecha_mantenimiento DATE,
  ADD COLUMN IF NOT EXISTS costo_total_mantenimiento DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS ot_firmada_doc_id UUID,
  ADD COLUMN IF NOT EXISTS ot_firmada_requerida BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_servicio_continuo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS orden_origen_id UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cadena_servicio_id UUID;
