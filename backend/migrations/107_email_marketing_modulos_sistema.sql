-- ============================================================
-- Migración 107: Registro del módulo email_marketing en permisos
-- ============================================================
-- Inserta el slug 'email_marketing' en modulos_sistema para que
-- el sistema de RBAC pueda gestionar permisos sobre él.
-- Asigna todos los permisos al rol 'admin'.
-- ============================================================

-- Insertar módulo si no existe
INSERT INTO modulos_sistema (slug, nombre, activo)
VALUES ('email_marketing', 'Email Marketing', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Asignar todos los permisos al rol admin
INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
SELECT
  r.id,
  ms.id,
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM roles r
JOIN modulos_sistema ms ON ms.slug = 'email_marketing'
WHERE r.slug = 'admin'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET puede_ver = TRUE, puede_crear = TRUE, puede_editar = TRUE,
      puede_eliminar = TRUE, puede_exportar = TRUE;
