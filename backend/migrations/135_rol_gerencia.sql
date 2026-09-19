-- ============================================================
-- Migración 135: Rol Gerencia para Dashboard Gerencial
-- ============================================================

-- Nuevo rol Gerencia
INSERT INTO roles (nombre, slug, descripcion, es_sistema)
VALUES ('Gerencia', 'gerencia', 'Acceso al dashboard gerencial con KPIs de alto nivel', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Otorgar acceso de ver a todos los módulos principales al rol Gerencia
DO $$
DECLARE
    r_gerencia UUID;
    m RECORD;
BEGIN
    SELECT id INTO r_gerencia FROM roles WHERE slug = 'gerencia';
    IF r_gerencia IS NULL THEN RETURN; END IF;

    FOR m IN SELECT id FROM modulos_sistema WHERE activo = TRUE
    LOOP
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar)
        VALUES (r_gerencia, m.id, TRUE, TRUE)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
