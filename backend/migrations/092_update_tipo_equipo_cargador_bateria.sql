-- ============================================================
-- Migración 092: Actualizar tipos de activo (Vehículo -> Cargador + Batería)
-- Fecha: 2026-07-25
-- ============================================================

BEGIN;

-- 1. Actualizar registros existentes que tengan 'VEHICULO' a 'CARGADOR'
UPDATE equipos
SET tipo_equipo = 'CARGADOR'
WHERE tipo_equipo = 'VEHICULO';

-- 2. Eliminar posibles restricciones tipo_equipo
ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_tipo_equipo_check;
ALTER TABLE equipos DROP CONSTRAINT IF EXISTS chk_equipos_tipo_equipo;

-- 3. Recrear la vista equipos_completo incluyendo CARGADOR y BATERIA
DROP VIEW IF EXISTS equipos_completo CASCADE;

CREATE VIEW equipos_completo AS
SELECT
  e.id,
  e.marca,
  e.modelo,
  e.serial,
  e.serie,
  e.color,
  -- Clasificación
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
  -- Especificaciones técnicas
  e.capacidad_carga,
  e.capacidad_nominal,
  e.motor,
  e.combustible,
  e.tipo_propulsion,
  CASE e.tipo_propulsion
    WHEN 'GLP'                    THEN 'GLP'
    WHEN 'GASOLINA'               THEN 'Gasolina'
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
  -- Métricas operativas
  e.horometro_actual,
  e.odometro,
  e.fecha_horometro,
  e.fecha_odometro,
  -- SOAT
  e.soat_vigente,
  e.soat_vencimiento,
  -- Bonificación por hora
  e.bonificacion_hora,
  -- Ubicación
  e.ubicacion_fisica,
  e.ciudad_ubicacion,
  -- Estado
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
  -- Foto
  e.foto_url,
  e.foto_thumb_url,
  -- Empresa
  emp.id            AS empresa_id,
  emp.name          AS empresa_nombre,
  emp.nit           AS empresa_nit,
  -- Auditoría
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM equipos e
LEFT JOIN companies emp ON emp.id = e.empresa_id
WHERE e.deleted_at IS NULL;

COMMIT;
