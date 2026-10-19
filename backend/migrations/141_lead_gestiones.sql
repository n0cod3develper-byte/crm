-- Migración 141: gestiones comerciales del Lead + evento de restauración
-- CARGAR S.A.S. - Módulo Leads
--
-- DOS COSAS:
--
--   1. `RESTAURACION` como tipo de evento del historial, para el nuevo
--      endpoint de restauración de leads archivados.
--
--   2. `lead_gestiones`: registro de la gestión comercial REAL (llamada,
--      reunión, correo, observación).
--
-- ── Por qué una tabla propia y no reutilizar `tasks` ──────────────────────────
-- Se analizó `tasks` antes de decidir. Encaja en parte: su CHECK de `type` ya
-- trae ('call','meeting','email','follow_up'), tiene related_type/related_id y
-- la Fase 3 ya la unía a la línea de tiempo. Pero NO sirve como almacén:
--
--   · `tasks.assigned_to` → users(id). Solo 8 de 17 empleados tienen cuenta de
--     usuario, que es exactamente por lo que la Fase 2 asignó leads a
--     employees. "Empleado que realizó la gestión" fallaría para 9 de ellos.
--   · No tiene campo de resultado.
--   · No tiene fecha/hora de la gestión, solo `created_at` (cuando se registró,
--     no cuándo ocurrió).
--   · `TasksRepository.findAll` filtra por usuario en no-admins
--     (assigned_to/created_by/supervisor), así que un gerente no vería las
--     gestiones del vendedor dentro del lead.
--   · Su semántica es "tarea pendiente" (priority, due_date, completed_at,
--     estimated_minutes). Una gestión comercial es un HECHO HISTÓRICO cerrado.
--
-- Además `tasks` solo tiene 3 filas y NINGUNA relacionada con leads, así que
-- no hay datos legados que migrar ni riesgo de duplicidad. El módulo Tasks no
-- se toca.
--
-- El catálogo de tipos se alinea con el de `tasks` para que el lenguaje sea el
-- mismo en todo el CRM.
--
-- ── Consistencia con lo ya decidido en Fase 2 y Fase 3 ──────────────────────
--   · `employee_id` apunta a `employees`, igual que `assigned_employee_id`.
--   · El nombre va denormalizado, igual que en `lead_history`, para conservar
--     la auditoría aunque el empleado se desactive o se elimine.
--   · `lead_id` es RESTRICT: las gestiones son parte de la trazabilidad del
--     lead y no se pueden destruir borrándolo (mismo criterio que 139/140).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nuevo tipo de evento en el historial
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE lead_history DROP CONSTRAINT IF EXISTS lead_history_event_type_chk;
ALTER TABLE lead_history
  ADD CONSTRAINT lead_history_event_type_chk
  CHECK (event_type IN (
    'CREACION', 'ASIGNACION', 'CAMBIO_ESTADO', 'MODIFICACION',
    'CIERRE', 'ACTIVIDAD', 'RESTAURACION'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Quién archivó el lead, denormalizado para la vista de archivados
-- ─────────────────────────────────────────────────────────────────────────────
-- `deleted_by` es un UUID sin FK (auditoría inmutable), así que un JOIN a
-- users perdería el nombre si el usuario se elimina. Va el nombre junto.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by_name VARCHAR(160);

COMMENT ON COLUMN leads.deleted_by_name IS
  'Nombre de quien archivó el lead. Denormalizado porque deleted_by no tiene FK.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla de gestiones comerciales
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_gestiones (
  id                 BIGSERIAL PRIMARY KEY,
  lead_id            UUID NOT NULL
                       REFERENCES leads(id) ON DELETE RESTRICT,
  tipo               VARCHAR(30) NOT NULL
                       CHECK (tipo IN ('llamada','reunion','correo','observacion','otro')),
  observaciones      TEXT,
  resultado          VARCHAR(120),
  -- Cuándo ocurrió la gestión (no cuándo se registró)
  fecha_gestion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Próxima fecha de seguimiento, cuando corresponda
  proxima_seguimiento TIMESTAMPTZ,
  -- Quién la realizó (EMPLEADO, no usuario: igual que la asignación de leads)
  employee_id        UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name      VARCHAR(160),   -- denormalizado a propósito
  created_by         UUID,
  created_by_name    VARCHAR(160),   -- denormalizado a propósito
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE lead_gestiones IS
  'Gestión comercial REAL de un lead (llamada, reunión, correo, observación). '
  'Hecho histórico cerrado, a diferencia de tasks que modela pendientes.';
COMMENT ON COLUMN lead_gestiones.fecha_gestion IS
  'Momento en que ocurrió la gestión. Es la que alimenta «última gestión comercial».';
COMMENT ON COLUMN lead_gestiones.employee_id IS
  'Empleado que realizó la gestión. Apunta a employees, no a users, porque no '
  'todos los empleados tienen cuenta (ver migración 138).';
COMMENT ON COLUMN lead_gestiones.employee_name IS
  'Nombre denormalizado para conservar la auditoría si el empleado se desactiva.';

-- El listado del lead ordena por fecha de gestión
CREATE INDEX IF NOT EXISTS idx_lead_gestiones_fecha
  ON lead_gestiones (lead_id, fecha_gestion DESC);

-- "Próximos seguimientos pendientes" (parcial: solo las que tienen fecha)
CREATE INDEX IF NOT EXISTS idx_lead_gestiones_proximas
  ON lead_gestiones (proxima_seguimiento)
  WHERE proxima_seguimiento IS NOT NULL;
