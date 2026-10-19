-- Migración 140: borrado lógico de Leads + trazabilidad permanente del historial
-- CARGAR S.A.S. - Módulo Leads
--
-- Dos problemas que resuelve:
--
--   1. `lead_history.lead_id` tenía ON DELETE CASCADE, con lo que ALIMINAR un lead
--      borraba también su trazabilidad. Verificado en la copia local: `lead_history`
--      llegó a tener 0 filas precisamente porque la cascada se había llevado todos
--      los eventos. Una auditoría que desaparece al borrar el registro no audita nada.
--
--   2. `leads` era el ÚNICO módulo del proyecto que hacía DELETE físico
--      (contacts, companies, opportunities, equipos, centros_costos, proveedores,
--      support_tickets, ordenes_trabajo, remisiones y las tablas de email-marketing
--      usan `deleted_at`). Se alinea Leads con ese patrón existente.
--
-- Se eligió borrado lógico en lugar de ON DELETE SET NULL porque SET NULL habría
-- eliminado el identificador del lead en cada evento, dejando la trazabilidad
-- huérfana y sin poder relacionarse con su lead original.
--
-- Consecuencia deliberada: una vez archivado, ningún `DELETE` físico de ese lead es
-- posible mientras tenga eventos (FK RESTRICT). Eso protege la auditoría.
-- (Las FKs con CASCADE de `lead_asignacion_notificaciones` quedan inalcanzables
--  por el mismo motivo: RESTRICT bloquea antes.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas de borrado lógico
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Sin FK a `users` a propósito: es un campo de auditoría histórico e inmutable,
-- igual que `lead_asignacion_notificaciones.asignado_por`. Eliminar un usuario
-- no debe poder bloquear la consulta del historial ni romperla.

COMMENT ON COLUMN leads.deleted_at IS
  'Archivo lógico: NULL = lead activo. Se conserva con toda su información y trazabilidad.';
COMMENT ON COLUMN leads.deleted_by IS
  'Usuario que archivó el lead. UUID sin FK por ser dato de auditoría inmutable.';

-- Índice parcial para el listado, que ahora filtra los archivados siempre
CREATE INDEX IF NOT EXISTS idx_leads_activos
  ON leads (created_at DESC)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. La trazabilidad del lead NO se puede destruir borrando el lead
-- ─────────────────────────────────────────────────────────────────────────────
-- ON DELETE RESTRICT mantiene `lead_id` NOT NULL: se conserva el identificador
-- histórico del lead y el historial continúa siendo consultable, que era el
-- requisito. SET NULL no serviría porque rompería esa relación.
ALTER TABLE lead_history DROP CONSTRAINT IF EXISTS lead_history_lead_id_fkey;
ALTER TABLE lead_history
  ADD CONSTRAINT lead_history_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT lead_history_lead_id_fkey ON lead_history IS
  'Bloquea el borrado físico de un lead con historial: la trazabilidad es permanente.';
