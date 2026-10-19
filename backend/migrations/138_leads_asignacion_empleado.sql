-- Migración 138: asignación de Leads a empleados (employees)
-- CARGAR S.A.S. - Módulo Leads
--
-- Contexto: leads.assigned_to apuntaba a users.id. El negocio necesita asignar el lead a
-- un EMPLEADO (employees), y no todos los empleados tienen cuenta de usuario (solo 8 de 17
-- en la copia de pruebas), por lo que el user_id no sirve como identificador de empleado.
--
-- Verificado sobre la copia local ANTES de escribir esta migración:
--   · employees.user_id es único  -> el backfill no es ambiguo.
--   · 36 de 36 leads asignados resuelven a un empleado vía users -> employees.user_id.
--   · Ninguna asignación existente apunta a un empleado inactivo.
--   · La única restricción sobre assigned_to era la FK leads_assigned_to_fkey (sin índices).
--
-- La migración es transaccional (el runner la envuelve en BEGIN/COMMIT): si la guarda del
-- backfill dispara, se revierte todo y assigned_to queda intacta.

-- 1. Columna nueva: asignación a empleado (opcional)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID
  REFERENCES employees(id) ON DELETE SET NULL;

-- 2. Backfill de las asignaciones existentes (users -> employees vía user_id)
UPDATE leads l
SET assigned_employee_id = e.id
FROM users u
JOIN employees e ON e.user_id = u.id
WHERE l.assigned_to = u.id
  AND l.assigned_employee_id IS NULL;

-- 3. Guarda: no retirar assigned_to si alguna asignación no migró
DO $$
DECLARE
  v_legacy  INTEGER;
  v_migrada INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_legacy  FROM leads WHERE assigned_to IS NOT NULL;
  SELECT COUNT(*) INTO v_migrada FROM leads WHERE assigned_employee_id IS NOT NULL;

  IF v_migrada < v_legacy THEN
    RAISE EXCEPTION
      'Backfill incompleto: % asignaciones legacy pero solo % migradas. Migración abortada, assigned_to se conserva.',
      v_legacy, v_migrada;
  END IF;

  RAISE NOTICE 'Backfill de asignaciones: % legacy -> % migradas', v_legacy, v_migrada;
END $$;

-- 4. Índice para el listado y el filtro por empleado
CREATE INDEX IF NOT EXISTS idx_leads_asignado_empleado
  ON leads (assigned_employee_id)
  WHERE assigned_employee_id IS NOT NULL;

-- 5. Retirar la columna legacy (ya replicada arriba, sin pérdida)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
ALTER TABLE leads DROP COLUMN IF EXISTS assigned_to;

COMMENT ON COLUMN leads.assigned_employee_id IS
  'Empleado responsable del lead (FK a employees). Opcional. Si el empleado pasa a inactivo se conserva la asignación histórica.';

-- 6. Registro de envíos de notificación (patrón outbox, igual que soat_email_notifications)
--    ON DELETE CASCADE en lead_id: el endpoint DELETE /api/v1/leads/:id debe seguir funcionando.
--    asignado_por es un UUID sin FK a propósito: es un campo de auditoría inmutable y una
--    eliminación de usuario no debe bloquearla ni romperla.
CREATE TABLE IF NOT EXISTS lead_asignacion_notificaciones (
    id            BIGSERIAL PRIMARY KEY,
    lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    empleado_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    asignado_por  UUID,
    dedup_key     VARCHAR(255) NOT NULL UNIQUE,
    recipients    TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (status IN ('pendiente','enviado','error')),
    attempts      SMALLINT NOT NULL DEFAULT 0,
    last_error    TEXT,
    sent_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_asignacion_notif_pendiente
    ON lead_asignacion_notificaciones (status)
    WHERE status = 'pendiente';
