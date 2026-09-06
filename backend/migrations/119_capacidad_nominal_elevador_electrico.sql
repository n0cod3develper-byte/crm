-- ============================================================
-- Migración 119: Capacidad Nominal — Agregar ELEVADOR ELÉCTRICO
-- ============================================================
-- Cambia capacidad_nominal de DECIMAL(5,1) a VARCHAR(50) para
-- soportar tanto valores numéricos (toneladas) como descriptivos
-- como 'ELEVADOR ELÉCTRICO'.
-- ============================================================

BEGIN;

-- 1. Eliminar la vista que depende de la columna antes de alterarla
DROP VIEW IF EXISTS equipos_completo;

-- 2. Eliminar el CHECK constraint existente
ALTER TABLE equipos
  DROP CONSTRAINT IF EXISTS equipos_capacidad_nominal_check;

-- 3. Cambiar el tipo de columna de DECIMAL(5,1) a VARCHAR(50)
--    Los valores numéricos existentes se convierten a texto
ALTER TABLE equipos
  ALTER COLUMN capacidad_nominal TYPE VARCHAR(50)
  USING capacidad_nominal::TEXT;

-- 4. Agregar nuevo CHECK constraint que acepte valores numéricos y el nuevo texto
ALTER TABLE equipos
  ADD CONSTRAINT equipos_capacidad_nominal_check
  CHECK (capacidad_nominal IN (
    '1.5', '2.0', '2.5', '3.0', '3.5',
    '4.0', '4.5', '5.0', '5.5', '6.0',
    '6.5', '7.0',
    'ELEVADOR ELÉCTRICO'
  ));

-- 5. Recrear la vista equipos_completo (misma definición que en migración 110)
CREATE VIEW equipos_completo AS
SELECT
  e.id,
  e.marca,
  e.modelo,
  e.serial,
  e.serie,
  e.color,
  e.tipo_equipo,
  CASE e.tipo_equipo
    WHEN 'MONTACARGAS' THEN 'Montacargas'
    WHEN 'ELEVADOR'    THEN 'Elevador'
    WHEN 'ESTIBADOR'   THEN 'Estibador'
    WHEN 'CAMIONETA'   THEN 'Camioneta'
    WHEN 'AMBULANCIA'  THEN 'Ambulancia'
    WHEN 'CARGADOR'    THEN 'Cargador'
    WHEN 'BATERIA'     THEN 'Batería'
    WHEN 'VEHICULO'    THEN 'Cargador'
  END AS tipo_equipo_label,
  e.capacidad_carga,
  e.capacidad_nominal,
  e.motor,
  e.combustible,
  e.tipo_propulsion,
  CASE e.tipo_propulsion
    WHEN 'GLP'                     THEN 'GLP'
    WHEN 'GASOLINA'                THEN 'Gasolina'
    WHEN 'ELECTRICO_BATERIA_LITIO' THEN 'Eléctrico / Batería Litio'
    WHEN 'ELECTRICO_BATERIA_PLOMO' THEN 'Eléctrico / Batería Plomo'
  END AS tipo_propulsion_label,
  e.tipo_mastil,
  CASE e.tipo_mastil
    WHEN 'SIMPLEX'    THEN 'Simplex'
    WHEN 'DUPLEX'     THEN 'Dúplex'
    WHEN 'TRIPLEX'    THEN 'Tríplex'
    WHEN 'CUADRUPLEX' THEN 'Cuádruple'
  END AS tipo_mastil_label,
  e.altura_maxima,
  e.horometro_actual,
  e.odometro,
  e.fecha_horometro,
  e.fecha_odometro,
  e.soat_vigente,
  e.soat_vencimiento,
  e.bonificacion_hora,
  e.ubicacion_fisica,
  e.ciudad_ubicacion,
  e.estado,
  CASE e.estado
    WHEN 'OPERATIVO'         THEN 'Operativo'
    WHEN 'EN_MANTENIMIENTO'  THEN 'En Mantenimiento'
    WHEN 'FUERA_DE_SERVICIO' THEN 'Fuera de Servicio'
    WHEN 'ALQUILADO'         THEN 'Alquilado'
    WHEN 'RETIRADO'          THEN 'Retirado'
  END AS estado_label,
  e.fecha_cambio_estado,
  e.motivo_estado,
  e.foto_url,
  e.foto_thumb_url,
  emp.id   AS empresa_id,
  emp.name AS empresa_nombre,
  emp.nit  AS empresa_nit,
  e.centro_costo_id,
  cc.nombre AS centro_costo_nombre,
  e.foto_path,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM equipos e
LEFT JOIN companies     emp ON emp.id = e.empresa_id
LEFT JOIN centros_costos cc ON cc.id  = e.centro_costo_id
WHERE e.deleted_at IS NULL;

COMMIT;
