-- ============================================================
-- Migración 067: Roles Dinámicos — Correcciones y mejoras
-- Fecha: 2026-06-23
-- ============================================================

-- 1. Agregar columna updated_at a roles si no existe
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Inicializar updated_at con created_at para registros existentes
UPDATE roles SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. Crear función de trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear trigger en tabla roles (idempotente)
DROP TRIGGER IF EXISTS set_roles_updated_at ON roles;
CREATE TRIGGER set_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- 4. Corregir slug de campañas: campanias → campanas (alinear con frontend)
<<<<<<< HEAD
UPDATE modulos_sistema SET slug = 'campanas' WHERE slug = 'campanias' AND NOT EXISTS (SELECT 1 FROM modulos_sistema WHERE slug = 'campanas');
=======
-- Solo si no existe ya un registro con slug = 'campanas'
UPDATE modulos_sistema SET slug = 'campanas'
WHERE slug = 'campanias'
  AND NOT EXISTS (SELECT 1 FROM modulos_sistema WHERE slug = 'campanas');
>>>>>>> f1c4b09 (fix: ajustes app.js, App.jsx y migración roles dinámicos (módulo certificados))

-- Actualizar también roles_permisos que apunten al módulo renombrado
-- (no es necesario porque la FK es por modulo_id, no por slug)

-- 5. Insertar módulos faltantes que el Sidebar usa pero no existen en BD
INSERT INTO modulos_sistema (nombre, slug, icono, ruta_base, orden_menu) VALUES
  ('Catálogo',  'catalogo',  'BookOpen',    '/catalogo',  7),
  ('Pipeline',  'pipeline',  'TrendingUp',  '/pipeline',  3),
  ('Tareas',    'tareas',    'CheckSquare', '/tasks',     4)
ON CONFLICT (slug) DO NOTHING;

-- 6. Dar permisos full al admin en todos los módulos nuevos que no tenga
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
            INSERT INTO roles_permisos (
                rol_id, modulo_id,
                puede_ver, puede_crear, puede_editar, puede_eliminar,
                puede_exportar, puede_aprobar, puede_liquidar
            ) VALUES (
                r_admin, m_id,
                TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
            ) ON CONFLICT (rol_id, modulo_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- 7. Dar permisos de solo lectura al rol consulta en módulos nuevos
DO $$
DECLARE
    r_consulta UUID;
    m_id UUID;
BEGIN
    SELECT id INTO r_consulta FROM roles WHERE slug = 'consulta';
    IF r_consulta IS NOT NULL THEN
        FOR m_id IN SELECT id FROM modulos_sistema WHERE slug IN ('catalogo', 'pipeline', 'tareas')
            AND id NOT IN (SELECT modulo_id FROM roles_permisos WHERE rol_id = r_consulta)
        LOOP
            INSERT INTO roles_permisos (
                rol_id, modulo_id,
                puede_ver, puede_exportar
            ) VALUES (
                r_consulta, m_id,
                TRUE, TRUE
            ) ON CONFLICT (rol_id, modulo_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;
