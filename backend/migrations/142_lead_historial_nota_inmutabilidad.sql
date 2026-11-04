-- ============================================================================
-- Migración 142: nota del cambio de estado e inmutabilidad del historial
-- CARGAR S.A.S. — Módulo Leads
--
-- Contexto (ver docs/leads/trazabilidad-estados-fase2-diseno.md):
--   `lead_history` (migración 139) ya guarda estado anterior/nuevo, usuario y
--   fecha, y `updateConHistorial`/`convertToContact` ya insertan CAMBIO_ESTADO
--   dentro de la misma transacción. Falta la NOTA que escribe el usuario y un
--   bloqueo real de modificaciones/borrados.
--
-- Idempotente: se puede re-ejecutar sin duplicar datos.
-- ============================================================================

-- 1. Nota escrita por el usuario --------------------------------------------
ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS nota TEXT;

COMMENT ON COLUMN lead_history.nota IS
  'Nota escrita por el usuario al cambiar de estado. NULL en eventos automáticos.';

-- 2. Un solo evento de creación por lead (protege el backfill) --------------
--    El índice parcial permite además que `ON CONFLICT DO NOTHING` sea seguro
--    aunque las 3 réplicas arranquen y ejecuten el runner a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_history_creacion
  ON lead_history (lead_id)
  WHERE event_type = 'CREACION';

-- 3. Backfill: un registro inicial por lead sin evento de creación ----------
--    · Cubre activos y archivados.
--    · Fecha = created_at del lead (decisión D3).
--    · metadata.origen = 'migracion' permite que la UI marque la duración como
--      no confiable y que el rollback identifique exactamente estas filas.
INSERT INTO lead_history (
  lead_id, event_type, field_name, old_value, new_value,
  description, nota, performed_by_user_id, performed_by_name,
  metadata, created_at
)
SELECT
  l.id,
  'CREACION',
  'status',
  NULL,
  l.status,
  'Registro inicial (migración): estado actual al habilitar la trazabilidad.',
  'Registro inicial (migración)',
  NULL,
  'Migración 142',
  jsonb_build_object('origen', 'migracion', 'estado_actual_al_migrar', true),
  l.created_at
FROM leads l
ON CONFLICT DO NOTHING;

-- 4. Inmutabilidad ----------------------------------------------------------
--    · DELETE: bloqueado salvo que se active explícitamente el escape de
--      mantenimiento (solo pruebas y seed; la API nunca lo activa).
--    · UPDATE: solo se permite anotar `metadata` (resultado del correo de
--      asignación, que se escribe DESPUÉS del commit por diseño). Cualquier
--      cambio en un campo auditado lanza una excepción.
CREATE OR REPLACE FUNCTION lead_history_proteger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.permite_borrar_historial', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'lead_history es inmutable: no se permite eliminar eventos (lead_id=%)',
      OLD.lead_id USING ERRCODE = 'restrict_violation';
  END IF;

  IF (NEW.id, NEW.lead_id, NEW.event_type, NEW.field_name,
      NEW.old_value, NEW.new_value, NEW.description, NEW.nota,
      NEW.performed_by_user_id, NEW.performed_by_name,
      NEW.assigned_employee_id, NEW.assigned_employee_name, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.lead_id, OLD.event_type, OLD.field_name,
      OLD.old_value, OLD.new_value, OLD.description, OLD.nota,
      OLD.performed_by_user_id, OLD.performed_by_name,
      OLD.assigned_employee_id, OLD.assigned_employee_name, OLD.created_at)
  THEN
    RAISE EXCEPTION 'lead_history es inmutable: solo se permite anotar metadata (id=%)',
      OLD.id USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION lead_history_proteger() IS
  'Bloquea UPDATE de campos auditados y DELETE en lead_history. El único UPDATE permitido es metadata (resultado del correo). Para mantenimiento/pruebas: SET app.permite_borrar_historial = on.';

DROP TRIGGER IF EXISTS trg_lead_history_proteger ON lead_history;
CREATE TRIGGER trg_lead_history_proteger
  BEFORE UPDATE OR DELETE ON lead_history
  FOR EACH ROW EXECUTE FUNCTION lead_history_proteger();

-- ============================================================================
-- Rollback documentado (NO ejecutar aquí):
--   DROP TRIGGER IF EXISTS trg_lead_history_proteger ON lead_history;
--   DROP FUNCTION IF EXISTS lead_history_proteger();
--   DROP INDEX IF EXISTS uq_lead_history_creacion;
--   SET app.permite_borrar_historial = 'on';
--   DELETE FROM lead_history WHERE metadata->>'origen' = 'migracion';
--   RESET app.permite_borrar_historial;
--   ALTER TABLE lead_history DROP COLUMN IF EXISTS nota;
-- ============================================================================
