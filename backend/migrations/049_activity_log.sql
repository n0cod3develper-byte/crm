-- ============================================================
-- Migración 049: Activity Log para Dashboard
-- Fecha: 2026-05-30
-- Descripción: Tabla unificada de actividad de usuarios en todos
-- los módulos + triggers automáticos en tablas clave.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. ACTIVITY LOG — Tabla unificada de actividad del sistema
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name   VARCHAR(255),
  modulo      VARCHAR(50) NOT NULL,
  accion      VARCHAR(30) NOT NULL
    CHECK (accion IN ('created', 'updated', 'deleted', 'status_changed', 'viewed', 'exported')),
  descripcion TEXT,
  ref_type    VARCHAR(50),
  ref_id      UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consulta rápida en el dashboard
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_modulo    ON activity_log(modulo);
CREATE INDEX IF NOT EXISTS idx_activity_log_accion    ON activity_log(accion);

-- ═══════════════════════════════════════════════════════════════
-- 2. FUNCIÓN TRIGGER GENÉRICA
-- ═══════════════════════════════════════════════════════════════
-- Uso: CREATE TRIGGER trg_log_<tabla>
--   AFTER INSERT OR UPDATE OR DELETE ON <tabla>
--   FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
--     'columna_user_id',   -- Columna UUID que referencia users (opcional, cadena vacía si no existe)
--     'columna_user_name', -- Columna VARCHAR con nombre de usuario (opcional)
--     'columna_nombre'     -- Columna para la descripción (name, serial, etc.)
--   );
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_activity_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id   UUID;
  v_user_name VARCHAR(255);
  v_accion    VARCHAR(30);
  v_modulo    VARCHAR(50);
  v_descripcion TEXT;
  v_ref_id    UUID;
  v_record    RECORD;
BEGIN
  -- Determinar acción
  IF TG_OP = 'INSERT' THEN
    v_accion := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_accion := 'updated';
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'deleted';
  END IF;

  -- Obtener el registro (NEW para INSERT/UPDATE, OLD para DELETE)
  IF TG_OP = 'DELETE' THEN
    v_record := OLD;
  ELSE
    v_record := NEW;
  END IF;

  v_ref_id := v_record.id;
  v_modulo := TG_TABLE_NAME;

  -- TG_ARGV[0]: user_id column (UUID)
  -- TG_ARGV[1]: user_name column (VARCHAR)
  -- TG_ARGV[2]: name column para descripción

  -- Extraer user_id si se especificó una columna UUID
  IF TG_NARGS >= 1 AND TG_ARGV[0] IS NOT NULL AND TG_ARGV[0] <> '' THEN
    BEGIN
      EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) INTO v_user_id USING v_record;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  -- Extraer user_name si se especificó una columna VARCHAR
  IF TG_NARGS >= 2 AND TG_ARGV[1] IS NOT NULL AND TG_ARGV[1] <> '' THEN
    BEGIN
      EXECUTE format('SELECT ($1).%I::varchar', TG_ARGV[1]) INTO v_user_name USING v_record;
    EXCEPTION WHEN OTHERS THEN
      v_user_name := NULL;
    END;
  END IF;

  -- Extraer descripción
  IF TG_NARGS >= 3 AND TG_ARGV[2] IS NOT NULL AND TG_ARGV[2] <> '' THEN
    BEGIN
      EXECUTE format('SELECT ($1).%I::text', TG_ARGV[2]) INTO v_descripcion USING v_record;
    EXCEPTION WHEN OTHERS THEN
      v_descripcion := NULL;
    END;
  END IF;

  -- Insertar en activity_log
  INSERT INTO activity_log (user_id, user_name, modulo, accion, descripcion, ref_type, ref_id, created_at)
  VALUES (v_user_id, v_user_name, v_modulo, v_accion, v_descripcion, v_modulo, v_ref_id, NOW());

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 3. TRIGGERS EN TABLAS CLAVE
-- ═══════════════════════════════════════════════════════════════

-- ── equipos: actualizado_por (VARCHAR) ────
DROP TRIGGER IF EXISTS trg_log_equipos ON equipos;
CREATE TRIGGER trg_log_equipos
  AFTER INSERT OR UPDATE OR DELETE ON equipos
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    '',              -- sin user_id UUID
    'actualizado_por', -- user_name VARCHAR
    'serial'         -- descripción
  );

-- ── ordenes_trabajo: created_by (UUID) ────
DROP TRIGGER IF EXISTS trg_log_ordenes_trabajo ON ordenes_trabajo;
CREATE TRIGGER trg_log_ordenes_trabajo
  AFTER INSERT OR UPDATE OR DELETE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    'created_by',    -- user_id UUID → se resuelve a nombre en activity_log
    '',              -- sin user_name VARCHAR separado
    'consecutivo'    -- descripción
  );

-- ── inventario (principal): registrado_por (VARCHAR) ────
DROP TRIGGER IF EXISTS trg_log_inventario ON inventario;
CREATE TRIGGER trg_log_inventario
  AFTER INSERT OR UPDATE OR DELETE ON inventario
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    '',                 -- sin user_id UUID
    'registrado_por',   -- user_name VARCHAR
    'name'              -- descripción
  );

-- ── inventario_locativo: registrado_por (VARCHAR) ────
DROP TRIGGER IF EXISTS trg_log_inventario_locativo ON inventario_locativo;
CREATE TRIGGER trg_log_inventario_locativo
  AFTER INSERT OR UPDATE OR DELETE ON inventario_locativo
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    '',                 -- sin user_id UUID
    'registrado_por',   -- user_name VARCHAR
    'nombre'            -- descripción
  );

-- ── proveedores: created_by (UUID) ────
DROP TRIGGER IF EXISTS trg_log_proveedores ON proveedores;
CREATE TRIGGER trg_log_proveedores
  AFTER INSERT OR UPDATE OR DELETE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    'created_by',    -- user_id UUID
    '',              -- sin user_name VARCHAR separado
    'razon_social'   -- descripción
  );

-- ── communications: created_by (UUID) ────
DROP TRIGGER IF EXISTS trg_log_communications ON communications;
CREATE TRIGGER trg_log_communications
  AFTER INSERT OR UPDATE OR DELETE ON communications
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    'created_by',     -- user_id UUID
    '',               -- sin user_name VARCHAR separado
    'subject'         -- descripción
  );
-- ── companies: sin columna de usuario, se muestra como "Sistema" ────
DROP TRIGGER IF EXISTS trg_log_companies ON companies;
CREATE TRIGGER trg_log_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    '',    -- sin user_id UUID
    '',    -- sin user_name VARCHAR
    'name' -- descripción
  );

-- ── employees: sin columna de usuario, se muestra como "Sistema" ────
DROP TRIGGER IF EXISTS trg_log_employees ON employees;
CREATE TRIGGER trg_log_employees
  AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger(
    '',        -- sin user_id UUID
    '',        -- sin user_name VARCHAR
    'full_name' -- descripción
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. MIGRAR DATOS HISTÓRICOS (opcional)
--    Toma las últimas comunicaciones como actividad inicial
-- ═══════════════════════════════════════════════════════════════
INSERT INTO activity_log (user_id, user_name, modulo, accion, descripcion, ref_type, ref_id, created_at)
SELECT
  c.created_by,
  u.full_name AS user_name,
  'communications' AS modulo,
  'created' AS accion,
  c.subject AS descripcion,
  'communications' AS ref_type,
  c.id AS ref_id,
  c.created_at
FROM communications c
LEFT JOIN users u ON u.id = c.created_by
WHERE c.created_at >= NOW() - INTERVAL '90 days'
  AND NOT EXISTS (SELECT 1 FROM activity_log a WHERE a.ref_type = 'communications' AND a.ref_id = c.id)
ORDER BY c.created_at DESC
LIMIT 200;

