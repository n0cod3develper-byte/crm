-- Migración 123: Crear tabla liquidacion_ajustes
-- Faltaba versionar esta tabla: existía únicamente en la base de datos local
-- (creada manualmente), por lo que nunca se aplicó en VPS/producción ni en
-- el entorno de Emily. Esquema replicado 1:1 desde el local vía pgAdmin.

CREATE TABLE IF NOT EXISTS liquidacion_ajustes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    remision_id UUID NOT NULL,
    quincena VARCHAR(20) NOT NULL,
    horas_ajustadas NUMERIC(10,2),
    nota TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT liquidacion_ajustes_pkey PRIMARY KEY (id),
    CONSTRAINT liquidacion_ajustes_remision_id_quincena_key UNIQUE (remision_id, quincena)
);