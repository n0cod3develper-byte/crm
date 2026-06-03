-- Migration: Add missing modules to modulos_sistema and assign to admin role
-- These modules exist in the sidebar but were not registered in the DB

-- Insert missing modules
INSERT INTO modulos_sistema (id, slug, nombre) VALUES
  (gen_random_uuid(), 'contactos',    'Contactos'),
  (gen_random_uuid(), 'pipeline',     'Pipeline'),
  (gen_random_uuid(), 'tareas',       'Tareas'),
  (gen_random_uuid(), 'cotizaciones', 'Cotizaciones'),
  (gen_random_uuid(), 'leads',        'Leads'),
  (gen_random_uuid(), 'campanas',     'Campañas'),
  (gen_random_uuid(), 'soporte',      'Soporte'),
  (gen_random_uuid(), 'catalogo',     'Catálogo'),
  (gen_random_uuid(), 'servicios',    'Servicios'),
  (gen_random_uuid(), 'informes',     'Informes')
ON CONFLICT (slug) DO NOTHING;

-- Assign all permissions to admin role for the new modules
INSERT INTO roles_permisos (id, rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
SELECT 
  gen_random_uuid(),
  r.id,
  ms.id,
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM roles r
CROSS JOIN modulos_sistema ms
WHERE r.slug = 'admin'
  AND ms.slug IN ('contactos','pipeline','tareas','cotizaciones','leads','campanas','soporte','catalogo','servicios','informes')
  AND NOT EXISTS (
    SELECT 1 FROM roles_permisos rp WHERE rp.rol_id = r.id AND rp.modulo_id = ms.id
  );
