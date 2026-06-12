-- ============================================================
-- Migración 060: Actualizar CHECK constraints de equipos
-- para soportar nuevos tipos de propulsión y motor
-- ============================================================

-- 1. Tipo Propulsión: agregar DIESEL, GAS, DUAL, ELECTRICO
ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_tipo_propulsion_check;
ALTER TABLE equipos ADD CONSTRAINT equipos_tipo_propulsion_check
  CHECK (tipo_propulsion IS NULL OR tipo_propulsion IN (
    'DIESEL', 'GAS', 'DUAL', 'ELECTRICO',
    'GLP', 'GASOLINA', 'ELECTRICO_BATERIA_LITIO', 'ELECTRICO_BATERIA_PLOMO'
  ));

-- 2. Motor: quitar la restricción fija y dejar libre (campo de texto con autocompletado)
ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_motor_check;

-- 3. Combustible: agregar nuevas opciones
ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_combustible_check;
ALTER TABLE equipos ADD CONSTRAINT equipos_combustible_check
  CHECK (combustible IS NULL OR combustible IN (
    'GLP', 'Gasolina', 'Eléctrico', 'Híbrido', 'Diesel', 'Gas', 'Dual'
  ));

-- 4. Tipo equipo viejo (chk_equipos_tipo_equipo): 
--    El formulario usa MONTACARGAS, ELEVADOR, etc. pero el CHECK viejo usa nombres largos.
--    Hacerlo permisivo para ambos esquemas.
ALTER TABLE equipos DROP CONSTRAINT IF EXISTS chk_equipos_tipo_equipo;
