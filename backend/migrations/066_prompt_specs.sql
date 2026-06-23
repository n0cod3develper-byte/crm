-- Migracion 066: Modulo Generador de Prompts (prompt_specs)
-- Tabla para almacenar el historial de prompts generados para nuevos modulos

CREATE TABLE IF NOT EXISTS prompt_specs (
    id SERIAL PRIMARY KEY,
    nombre_modulo VARCHAR(150) NOT NULL,
    area VARCHAR(50) NOT NULL,
    objetivo TEXT NOT NULL,
    entidades TEXT,
    reglas_negocio TEXT,
    relaciones JSONB DEFAULT '[]'::jsonb,
    datos_sensibles BOOLEAN NOT NULL DEFAULT false,
    requiere_ui BOOLEAN NOT NULL DEFAULT true,
    notas_extra TEXT,
    prompt_generado TEXT NOT NULL,
    creado_por UUID NOT NULL REFERENCES users(id),
    clonado_de INTEGER REFERENCES prompt_specs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_specs_area ON prompt_specs(area);
CREATE INDEX IF NOT EXISTS idx_prompt_specs_creado_por ON prompt_specs(creado_por);
CREATE INDEX IF NOT EXISTS idx_prompt_specs_created_at ON prompt_specs(created_at DESC);
