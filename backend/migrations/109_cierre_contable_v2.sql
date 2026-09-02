-- 109_cierre_contable_v2.sql
-- Migración para el cierre contable mensual v2 y reapertura de periodos

-- 1. Eliminar primero la restricción check vieja para permitir cambios de estado temporalmente
ALTER TABLE ot_cortes_contables DROP CONSTRAINT IF EXISTS ot_cortes_contables_estado_check;

-- 2. Actualizar estados antiguos de 'EJECUTADO' a 'CERRADO'
UPDATE ot_cortes_contables SET estado = 'CERRADO' WHERE estado = 'EJECUTADO';

-- 3. Crear la nueva restricción check ampliada
ALTER TABLE ot_cortes_contables ADD CONSTRAINT ot_cortes_contables_estado_check
  CHECK (estado IN ('PROPUESTO', 'CONFIRMADO', 'EN_GRACIA', 'CERRADO', 'REABIERTO', 'CANCELADO', 'EJECUTADO'));

-- 4. Columnas nuevas en ot_cortes_contables
ALTER TABLE ot_cortes_contables
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_gracia DATE,
  ADD COLUMN IF NOT EXISTS cerrado_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cerrado_por              UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reabierto_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reabierto_por            UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificacion_reapertura TEXT;

-- 5. Columnas nuevas en ordenes_trabajo (para bloqueo retroactivo)
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS fecha_ultimo_corte DATE,
  ADD COLUMN IF NOT EXISTS periodo_cierre_id  UUID REFERENCES ot_cortes_contables(id) ON DELETE SET NULL;

-- 6. Nuevo rol Contabilidad
INSERT INTO roles (nombre, slug, descripcion, es_sistema)
VALUES ('Contabilidad', 'contabilidad', 'Gestiona cierres y periodos contables', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 7. Permisos del rol Contabilidad en modulo ordenes_trabajo
DO $$
DECLARE
  r_cont UUID;
  m_ot   UUID;
BEGIN
  SELECT id INTO r_cont FROM roles WHERE slug = 'contabilidad';
  SELECT id INTO m_ot   FROM modulos_sistema WHERE slug = 'ordenes_trabajo';
  IF r_cont IS NOT NULL AND m_ot IS NOT NULL THEN
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar, puede_aprobar, puede_liquidar)
    VALUES (r_cont, m_ot, TRUE, TRUE, TRUE, TRUE)
    ON CONFLICT (rol_id, modulo_id) DO UPDATE
      SET puede_ver=TRUE, puede_exportar=TRUE, puede_aprobar=TRUE, puede_liquidar=TRUE;
  END IF;
END $$;

-- 8. Índices de optimización
CREATE INDEX IF NOT EXISTS idx_ot_fecha_ultimo_corte ON ordenes_trabajo(fecha_ultimo_corte) WHERE fecha_ultimo_corte IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ot_cortes_estado ON ot_cortes_contables(estado);
CREATE INDEX IF NOT EXISTS idx_ot_cortes_vencimiento ON ot_cortes_contables(fecha_vencimiento_gracia) WHERE estado = 'EN_GRACIA';
