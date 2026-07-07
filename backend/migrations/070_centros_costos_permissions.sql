-- ============================================================
-- Migración 070: Permisos Centro de Costos
-- ============================================================

-- 1. Insertar módulo
INSERT INTO modulos_sistema (nombre, slug, icono, ruta_base, orden_menu) 
VALUES ('Centros de Costos', 'centros_costos', 'Briefcase', '/centros-costos', 15)
ON CONFLICT (slug) DO NOTHING;

-- 2. Asignar permisos (crear, leer, actualizar, borrar) a roles: admin, facturador, contabilidad
DO $$
DECLARE
    m_id UUID;
    r_id UUID;
    r_slug TEXT;
    roles_list TEXT[] := ARRAY['admin', 'facturador', 'contabilidad'];
BEGIN
    SELECT id INTO m_id FROM modulos_sistema WHERE slug = 'centros_costos';
    
    IF m_id IS NOT NULL THEN
        FOREACH r_slug IN ARRAY roles_list
        LOOP
            SELECT id INTO r_id FROM roles WHERE slug = r_slug;
            IF r_id IS NOT NULL THEN
                INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar)
                VALUES (r_id, m_id, TRUE, TRUE, TRUE, TRUE, FALSE)
                ON CONFLICT (rol_id, modulo_id) DO UPDATE SET
                    puede_ver = TRUE, puede_crear = TRUE, puede_editar = TRUE, puede_eliminar = TRUE;
            END IF;
        END LOOP;
    END IF;
END $$;
