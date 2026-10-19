-- Migración 130: crea tabla remision_dias_fijo
-- Corrige bug de producción: estas columnas/tabla existían solo en la base local

BEGIN;

CREATE TABLE IF NOT EXISTS remision_dias_fijo (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remision_id         UUID NOT NULL, -- FK asumiendo remisiones o facturacion
  empleado_id         UUID NOT NULL,
  fecha               DATE NOT NULL,
  hora_entrada        TIME,
  hora_salida         TIME,
  descuento_desayuno  BOOLEAN DEFAULT FALSE,
  descuento_almuerzo  BOOLEAN DEFAULT FALSE,
  minutos_descuento   INT DEFAULT 0,
  horas_brutas        NUMERIC(12,2),
  horas_netas         NUMERIC(12,2),
  bonificacion_hora   NUMERIC(12,2),
  comision            NUMERIC(12,2),
  notas               TEXT,
  horometro_inicial   NUMERIC(12,2),
  horometro_final     NUMERIC(12,2),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(remision_id, empleado_id, fecha)
);

COMMIT;