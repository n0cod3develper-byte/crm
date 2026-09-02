-- ============================================================
-- Migración 110: Agregar centro_costo_id a equipos
-- ============================================================

-- 1. Agregar columna centro_costo_id (NULLABLE para no romper los 11 equipos existentes)
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS centro_costo_id UUID REFERENCES centros_costos(id);

-- 2. Índice para búsquedas por centro de costo
CREATE INDEX IF NOT EXISTS idx_equipos_centro_costo_id ON equipos(centro_costo_id);

-- 3. Drop and recreate the view to include centro_costo columns
DROP VIEW IF EXISTS equipos_completo;
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
