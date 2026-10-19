-- Migración 139: historial y trazabilidad de Leads
-- CARGAR S.A.S. - Módulo Leads
--
-- Contexto: se verificó que NO existe un historial reutilizable para leads.
--   · `audit_logs` ya audita /api/v1/leads pero corre en el evento 'finish' (fire-and-forget,
--     fuera de transacción), guarda el body de la petición en datos_antes y deja datos_despues
--     en NULL: no permite comparación campo a campo ni revertir si falla.
--   · `activity_log` es historial general (ref_type/ref_id) pero guarda texto libre, le faltan
--     field_name/old_value/new_value/assigned_employee_id/metadata, y no tiene índice sobre
--     (ref_type, ref_id).
--   · Existen precedentes del patrón en `opportunity_stage_history` y `equipos_historial_estado`.
--
-- Por eso se crea una tabla dedicada, con la estructura pedida y con nombres denormalizados
-- para que los eventos sigan siendo comprensibles aunque el empleado o el usuario se desactiven.

CREATE TABLE IF NOT EXISTS lead_history (
    id                     BIGSERIAL PRIMARY KEY,
    lead_id                UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_type             VARCHAR(40) NOT NULL,
    field_name             VARCHAR(80),
    old_value              TEXT,
    new_value              TEXT,
    description            TEXT,
    performed_by_user_id   UUID,
    performed_by_name      VARCHAR(160),
    assigned_employee_id   UUID,
    assigned_employee_name VARCHAR(160),
    metadata               JSONB,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT lead_history_event_type_chk CHECK (
        event_type IN ('CREACION','ASIGNACION','CAMBIO_ESTADO','MODIFICACION','CIERRE','ACTIVIDAD')
    )
);

-- Línea de tiempo principal: orden descendente con criterio secundario estable (id)
CREATE INDEX IF NOT EXISTS idx_lead_history_lead
    ON lead_history (lead_id, created_at DESC, id DESC);

-- Filtro por tipo de evento dentro de un lead
CREATE INDEX IF NOT EXISTS idx_lead_history_lead_tipo
    ON lead_history (lead_id, event_type, created_at DESC);

-- Filtro por rango de fechas dentro de un lead
CREATE INDEX IF NOT EXISTS idx_lead_history_lead_fecha
    ON lead_history (lead_id, created_at);

COMMENT ON TABLE lead_history IS
  'Trazabilidad de Leads: creación, asignaciones, cambios de estado y modificaciones campo a campo.';
COMMENT ON COLUMN lead_history.performed_by_name IS
  'Nombre del usuario en el momento del evento. Denormalizado a propósito para conservar la auditoría.';
COMMENT ON COLUMN lead_history.assigned_employee_name IS
  'Nombre del empleado en el momento del evento. Se conserva aunque el empleado se desactive.';
COMMENT ON COLUMN lead_history.metadata IS
  'Datos adicionales del evento (p. ej. resultado del correo de notificación).';
