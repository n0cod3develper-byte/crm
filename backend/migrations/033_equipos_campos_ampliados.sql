-- ============================================================
-- Migración 024: Ampliar tabla equipos con campos operativos
-- Fecha: 2026-05-11
-- ============================================================

ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS tipo_equipo           VARCHAR(60)    NOT NULL DEFAULT 'Montacargas contrabalanceo',
  ADD COLUMN IF NOT EXISTS estado_inicial        VARCHAR(30)    NOT NULL DEFAULT 'Operativo',
  ADD COLUMN IF NOT EXISTS ubicacion             VARCHAR(50)    NOT NULL DEFAULT 'Taller',
  ADD COLUMN IF NOT EXISTS horometro_inicial     INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_adquisicion     DATE,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_garantia DATE,
  ADD COLUMN IF NOT EXISTS horas_operacion_diaria DECIMAL(5,2);

-- CHECK constraints
ALTER TABLE equipos
  DROP CONSTRAINT IF EXISTS chk_equipos_tipo_equipo,
  DROP CONSTRAINT IF EXISTS chk_equipos_estado_inicial,
  DROP CONSTRAINT IF EXISTS chk_equipos_ubicacion;

ALTER TABLE equipos
  ADD CONSTRAINT chk_equipos_tipo_equipo CHECK (
    tipo_equipo IN (
      'Montacargas contrabalanceo',
      'Reach truck',
      'Montacargas eléctrico',
      'Elevador de tijera',
      'Elevador de mástil',
      'Otro'
    )
  ),
  ADD CONSTRAINT chk_equipos_estado_inicial CHECK (
    estado_inicial IN ('Operativo', 'En taller', 'En bodega', 'Fuera de servicio')
  ),
  ADD CONSTRAINT chk_equipos_ubicacion CHECK (
    ubicacion IN ('Taller', 'Bodega', 'Exterior', 'Otro')
  );
