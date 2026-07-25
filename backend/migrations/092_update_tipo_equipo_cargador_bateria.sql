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
  e.altura_maxima_mastil,
  e.horometro_actual,
  e.horometro_inicial,
  e.horometro_mantenimiento,
  e.proximo_mantenimiento_horas,
  -- Fechas y documentos
  e.fecha_fabricacion,
  e.fecha_adquisicion,
  e.numero_chasis,
  e.numero_motor,
  e.placa,
  e.propietario,
  e.soat_numero,
  e.soat_fecha_vencimiento,
  e.tecnicomecanica_fecha_vencimiento,
  -- Estado y ubicación
  e.estado,
  CASE e.estado
    WHEN 'OPERATIVO'         THEN 'Operativo'
    WHEN 'EN_MANTENIMIENTO'  THEN 'En Mantenimiento'
    WHEN 'FUERA_DE_SERVICIO' THEN 'Fuera de Servicio'
    WHEN 'ALQUILADO'         THEN 'Alquilado'
    WHEN 'RETIRADO'          THEN 'Retirado'
  END AS estado_label,
  e.empresa_id,
  c.name AS empresa_nombre,
  e.ubicacion,
  e.motivo_estado,
  e.observaciones,
  e.imagen_url,
  e.frecuencia_mantenimiento_horas,
  e.bonificacion_hora,
  -- Auditoría
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM equipos e
LEFT JOIN companies c ON c.id = e.empresa_id
WHERE e.deleted_at IS NULL;

COMMIT;
