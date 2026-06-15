DROP TABLE IF EXISTS budget_monthly_detail CASCADE;
DROP TABLE IF EXISTS budget_equipment CASCADE;
DROP TABLE IF EXISTS budget_annual CASCADE;
DROP TABLE IF EXISTS budget_areas CASCADE;

CREATE TABLE IF NOT EXISTS budget_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_annual (
    id SERIAL PRIMARY KEY,
    area_id INTEGER NOT NULL REFERENCES budget_areas(id),
    year INTEGER NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(area_id, year)
);

CREATE TABLE IF NOT EXISTS budget_equipment (
    id SERIAL PRIMARY KEY,
    budget_annual_id INTEGER NOT NULL REFERENCES budget_annual(id),
    equipment_id UUID NOT NULL REFERENCES equipos(id),
    location VARCHAR(255),
    working_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(budget_annual_id, equipment_id)
);

CREATE TABLE IF NOT EXISTS budget_monthly_detail (
    id SERIAL PRIMARY KEY,
    budget_equipment_id INTEGER NOT NULL REFERENCES budget_equipment(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    amount NUMERIC(15, 2) NOT NULL,
    working_days INTEGER CHECK (working_days >= 0 AND working_days <= 31),
    UNIQUE(budget_equipment_id, month)
);

INSERT INTO budget_areas (name, description) 
VALUES 
('Mantenimiento', 'Presupuesto para el área de mantenimiento'),
('Servicios', 'Presupuesto para el área de servicios')
ON CONFLICT (name) DO NOTHING;
