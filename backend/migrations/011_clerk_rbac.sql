-- Migración para el sistema de Clerk + RBAC
-- Parte 2 del plan: Modelo de datos propio

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(80)  UNIQUE NOT NULL,
  slug        VARCHAR(80)  UNIQUE NOT NULL,
  descripcion TEXT,
  es_sistema  BOOLEAN DEFAULT FALSE,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Seeds: roles del sistema
INSERT INTO roles (nombre, slug, descripcion, es_sistema) VALUES
  ('Administrador',           'admin',           'Acceso total al sistema', TRUE),
  ('Supervisor Mantenimiento','supervisor_mant',  'Gestiona OTs y técnicos', TRUE),
  ('Técnico',                 'tecnico',          'Ejecuta órdenes de trabajo', TRUE),
  ('Almacenista',             'almacenista',      'Gestiona inventario y recepciones', TRUE),
  ('Comprador',               'comprador',        'Gestiona proveedores y OCs', TRUE),
  ('Aprobador Nivel 1',       'aprobador_1',      'Aprueba OCs hasta límite nivel 1', TRUE),
  ('Aprobador Nivel 2',       'aprobador_2',      'Aprueba OCs hasta límite nivel 2', TRUE),
  ('Aprobador Nivel 3',       'aprobador_3',      'Aprueba OCs sin límite de monto', TRUE),
  ('Consulta',                'consulta',         'Solo lectura en módulos asignados', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabla de Usuarios CRM (Espejo de Clerk)
CREATE TABLE IF NOT EXISTS usuarios_crm (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id VARCHAR(100) UNIQUE NOT NULL,
  rol_id        UUID REFERENCES roles(id),
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100),
  email         VARCHAR(150) UNIQUE NOT NULL,
  telefono      VARCHAR(30),
  avatar_url    VARCHAR(300),
  estado        VARCHAR(20) DEFAULT 'ACTIVO'
                CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_crm_clerk_id ON usuarios_crm(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_crm_rol ON usuarios_crm(rol_id);

-- 3. Tabla de Módulos del Sistema
CREATE TABLE IF NOT EXISTS modulos_sistema (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(80)  NOT NULL,
  slug        VARCHAR(80)  UNIQUE NOT NULL,
  icono       VARCHAR(50),
  ruta_base   VARCHAR(100),
  orden_menu  INT DEFAULT 0,
  activo      BOOLEAN DEFAULT TRUE
);

-- Seeds: Módulos
INSERT INTO modulos_sistema (nombre, slug, icono, ruta_base, orden_menu) VALUES
  ('Empresas',               'empresas',          'Building2',      '/empresas',   1),
  ('Equipos',                'equipos',           'Forklift',       '/equipos',    2),
  ('Empleados',              'empleados',         'Users',          '/empleados',  3),
  ('Órdenes de Trabajo',     'ordenes_trabajo',   'ClipboardList',  '/ot',         4),
  ('Proveedores',            'proveedores',       'Truck',          '/proveedores',5),
  ('Órdenes de Compra',      'ordenes_compra',    'ShoppingCart',   '/oc',         6),
  ('Inventario',             'inventario',        'Package',        '/inventario', 7),
  ('Reportes',               'reportes',          'BarChart2',      '/reportes',   8),
  ('Admin Usuarios',         'admin_usuarios',    'ShieldCheck',    '/admin/users',9),
  ('Configuración',          'configuracion',     'Settings',       '/config',     10)
ON CONFLICT (slug) DO NOTHING;

-- 4. Tabla de Roles y Permisos (Matriz)
CREATE TABLE IF NOT EXISTS roles_permisos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id          UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  modulo_id       UUID NOT NULL REFERENCES modulos_sistema(id) ON DELETE CASCADE,
  puede_ver       BOOLEAN DEFAULT FALSE,
  puede_crear     BOOLEAN DEFAULT FALSE,
  puede_editar    BOOLEAN DEFAULT FALSE,
  puede_eliminar  BOOLEAN DEFAULT FALSE,
  puede_exportar  BOOLEAN DEFAULT FALSE,
  puede_aprobar   BOOLEAN DEFAULT FALSE,
  puede_liquidar  BOOLEAN DEFAULT FALSE,
  UNIQUE (rol_id, modulo_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_permisos_rol ON roles_permisos(rol_id);

-- 5. Tabla de Auditoría de Permisos
CREATE TABLE IF NOT EXISTS auditoria_permisos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accion          VARCHAR(80) NOT NULL,
  ejecutado_por   VARCHAR(100) NOT NULL, -- clerk_user_id del admin
  entidad_tipo    VARCHAR(30),           -- 'ROL' | 'USUARIO' | 'PERMISO'
  entidad_id      UUID,
  detalle         JSONB,                 -- { antes: {}, despues: {} }
  ip_origen       VARCHAR(45),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Seeds: Matriz de permisos inicial
-- Función auxiliar para asignar permisos
DO $$
DECLARE
    r_admin UUID;
    r_supervisor UUID;
    r_tecnico UUID;
    r_almacenista UUID;
    r_comprador UUID;
    r_aprobador1 UUID;
    r_aprobador2 UUID;
    r_aprobador3 UUID;
    r_consulta UUID;
    r_id UUID;
    m_id UUID;
BEGIN
    SELECT id INTO r_admin FROM roles WHERE slug = 'admin';
    SELECT id INTO r_supervisor FROM roles WHERE slug = 'supervisor_mant';
    SELECT id INTO r_tecnico FROM roles WHERE slug = 'tecnico';
    SELECT id INTO r_almacenista FROM roles WHERE slug = 'almacenista';
    SELECT id INTO r_comprador FROM roles WHERE slug = 'comprador';
    SELECT id INTO r_aprobador1 FROM roles WHERE slug = 'aprobador_1';
    SELECT id INTO r_aprobador2 FROM roles WHERE slug = 'aprobador_2';
    SELECT id INTO r_aprobador3 FROM roles WHERE slug = 'aprobador_3';
    SELECT id INTO r_consulta FROM roles WHERE slug = 'consulta';

    -- Permisos ADMIN: TRUE en todo en todos los módulos
    FOR m_id IN SELECT id FROM modulos_sistema LOOP
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
        VALUES (r_admin, m_id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Permisos SUPERVISOR MANTENIMIENTO
    -- OT y Equipos: ver+crear+editar+exportar, liquidar
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_exportar, puede_liquidar)
    SELECT r_supervisor, id, TRUE, TRUE, TRUE, TRUE, TRUE FROM modulos_sistema WHERE slug IN ('ordenes_trabajo', 'equipos')
    ON CONFLICT DO NOTHING;
    -- Empresas y Empleados: ver+exportar
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar)
    SELECT r_supervisor, id, TRUE, TRUE FROM modulos_sistema WHERE slug IN ('empresas', 'empleados')
    ON CONFLICT DO NOTHING;

    -- Permisos TECNICO
    -- Empresas y Equipos: ver
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver)
    SELECT r_tecnico, id, TRUE FROM modulos_sistema WHERE slug IN ('empresas', 'equipos')
    ON CONFLICT DO NOTHING;
    -- OT: ver+crear+liquidar
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_liquidar)
    SELECT r_tecnico, id, TRUE, TRUE, TRUE FROM modulos_sistema WHERE slug = 'ordenes_trabajo'
    ON CONFLICT DO NOTHING;

    -- Permisos ALMACENISTA
    -- Inventario: ver+crear+editar+exportar
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_exportar)
    SELECT r_almacenista, id, TRUE, TRUE, TRUE, TRUE FROM modulos_sistema WHERE slug = 'inventario'
    ON CONFLICT DO NOTHING;
    -- OC: ver+exportar
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar)
    SELECT r_almacenista, id, TRUE, TRUE FROM modulos_sistema WHERE slug = 'ordenes_compra'
    ON CONFLICT DO NOTHING;

    -- Permisos COMPRADOR
    -- Proveedores y OC: ver+crear+editar+exportar
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_exportar)
    SELECT r_comprador, id, TRUE, TRUE, TRUE, TRUE FROM modulos_sistema WHERE slug IN ('proveedores', 'ordenes_compra')
    ON CONFLICT DO NOTHING;

    -- Permisos APROBADORES 1, 2, 3
    -- OC: ver+exportar+aprobar
    FOR r_id IN (SELECT id FROM roles WHERE slug IN ('aprobador_1', 'aprobador_2', 'aprobador_3')) LOOP
        INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar, puede_aprobar)
        SELECT r_id, id, TRUE, TRUE, TRUE FROM modulos_sistema WHERE slug = 'ordenes_compra'
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Permisos CONSULTA
    -- ver+exportar en varios módulos
    INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_exportar)
    SELECT r_consulta, id, TRUE, TRUE FROM modulos_sistema WHERE slug IN ('empresas', 'equipos', 'ordenes_trabajo', 'inventario', 'reportes')
    ON CONFLICT DO NOTHING;

END $$;
