-- ============================================================
-- Migración 086: Catálogo de Componentes/Sistemas (Mantenimiento)
-- Fecha: 2026-07-17
-- ============================================================

CREATE TABLE IF NOT EXISTS mantenimiento_componentes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    descripcion TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed inicial de componentes sugeridos
INSERT INTO mantenimiento_componentes (nombre, descripcion)
VALUES
    ('Sistema Hidráulico', 'Bomba, mangueras, cilindros, válvulas, etc.'),
    ('Motor', 'Bloque, culata, pistones, inyección, refrigeración, etc.'),
    ('Sistema Eléctrico', 'Batería, cableado, luces, sensores, alternador, etc.'),
    ('Transmisión', 'Caja de cambios, convertidor, diferencial, etc.'),
    ('Frenos', 'Zapatas, discos, campanas, líquido, etc.'),
    ('Llantas/Rodamiento', 'Neumáticos, rines, rodamientos, etc.'),
    ('Mástil/Elevación', 'Cadenas, rodillos, uñas, estructura del mástil.'),
    ('Dirección', 'Bomba de dirección, cilindro de dirección, terminales, etc.'),
    ('Otro', 'Componentes no clasificados')
ON CONFLICT (nombre) DO NOTHING;
