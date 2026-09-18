-- ============================================================
-- Migración 133: Creación de tablas de Jornadas Laborales
-- ============================================================

BEGIN;

-- 1. Actualizar configuración para usar jornada ordinaria decimal en lugar de minutos
ALTER TABLE horas_extras_configuracion 
ADD COLUMN IF NOT EXISTS jornada_ordinaria_decimal NUMERIC(10, 4);

-- Poblar con los valores por defecto exigidos
UPDATE horas_extras_configuracion SET jornada_ordinaria_decimal = 8.42 WHERE dia_aplicacion = 'LUN_JUE';
UPDATE horas_extras_configuracion SET jornada_ordinaria_decimal = 8.33 WHERE dia_aplicacion = 'VIE';
UPDATE horas_extras_configuracion SET jornada_ordinaria_decimal = 0 WHERE dia_aplicacion IN ('SAB', 'DOM_FESTIVO');

-- 2. Crear tabla principal de jornadas_laborales
CREATE TABLE IF NOT EXISTS jornadas_laborales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES employees(id),
    remision_id UUID NULL REFERENCES remisiones(id), -- Opcional
    fecha_trabajo DATE NOT NULL,
    hora_entrada TIME NOT NULL,
    hora_salida TIME NOT NULL,
    minutos_descuento INTEGER NOT NULL DEFAULT 50,
    observacion TEXT,
    
    -- Snapshots Históricos
    salario_mensual NUMERIC NOT NULL,
    valor_hora_base NUMERIC NOT NULL,
    
    -- Tiempos y Cálculos Totales
    horas_trabajadas NUMERIC NOT NULL,
    total_horas_ordinarias NUMERIC NOT NULL,
    total_horas_extras NUMERIC NOT NULL,
    total_rno NUMERIC NOT NULL,
    total_liquidado NUMERIC NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear tabla detalle de jornada
CREATE TABLE IF NOT EXISTS jornadas_laborales_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jornada_id UUID NOT NULL REFERENCES jornadas_laborales(id) ON DELETE CASCADE,
    tipo_hora VARCHAR(50) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    minutos INTEGER NOT NULL,
    horas_decimal NUMERIC NOT NULL,
    porcentaje NUMERIC NOT NULL,
    valor_hora NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    es_liquidable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
