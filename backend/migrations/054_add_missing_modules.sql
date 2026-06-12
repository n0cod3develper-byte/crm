-- Migración 054: Agregar módulos faltantes al sistema
INSERT INTO modulos_sistema (nombre, slug, icono, ruta_base, orden_menu) VALUES
  ('Soporte',              'soporte',         'Headphones',    '/soporte',        11),
  ('Facturación',          'facturacion',      'Receipt',       '/facturacion',    12),
  ('Servicios',            'servicios',        'Wrench',        '/servicios',      13),
  ('Turnos',               'turnos',           'Clock',         '/turnos',         14),
  ('Dashboard',            'dashboard',        'LayoutDashboard','/dashboard',     0),
  ('Campañas',             'campanias',        'Megaphone',     '/campaigns',      15),
  ('Locativo',             'locativo',         'MapPin',        '/locativo',       16),
  ('Documentos',           'documentos',       'FileText',      '/documentos',     17),
  ('Catálogo Servicios',   'catalogo_servicios','BookOpen',     '/catalogo-servicios', 18),
  ('Mantenimientos Prog.', 'mant_programados', 'Calendar',      '/mantenimientos-programados', 19),
  ('Contactos',            'contactos',        'Contact2',      '/contacts',       20),
  ('Cotizaciones',         'cotizaciones',     'FileSpreadsheet','/quotes',        21),
  ('Leads',                'leads',            'Target',        '/leads',          22)
ON CONFLICT (slug) DO NOTHING;

-- Dar permisos full al admin en todos los módulos nuevos
DO $$
DECLARE
    r_admin UUID;
    m_id UUID;
BEGIN
    SELECT id INTO r_admin FROM roles WHERE slug = 'admin';
    IF r_admin IS NOT NULL THEN
        FOR m_id IN SELECT id FROM modulos_sistema WHERE id NOT IN (
            SELECT modulo_id FROM roles_permisos WHERE rol_id = r_admin
        ) LOOP
            INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
            VALUES (r_admin, m_id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
