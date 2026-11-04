-- ============================================================================
-- ⚠️  SCRIPT DE PRUEBA — SOLO COPIA LOCAL (prueba_restore)
--     NUNCA EJECUTAR EN PRODUCCIÓN.
--
-- Guarda anti-producción: se niega a ejecutar si el nombre de la base no
-- contiene prueba/test/dev/local/sandbox/tmp. Si algún día hace falta
-- cambiar el patrón, hay que pensarlo dos veces.
-- ============================================================================
DO $$
BEGIN
  IF current_database() !~* '(prueba|test|dev|local|sandbox|tmp)' THEN
    RAISE EXCEPTION 'SCRIPT DE PRUEBA LOCAL: se niega a ejecutar en la base «%»', current_database();
  END IF;
END $$;

-- ============================================================================
-- Fase 1 (diseño) del módulo Leads: genera ~100 leads sintéticos con valores
-- de "source" sucios y todos los estados, para validar la normalización a
-- catálogo (ítem A) y la regla de temperatura (ítem F).
--
-- Idempotente: borra antes las filas marcadas y las vuelve a crear.
-- Todos los leads generados llevan la marca "[SEED-FASE1]" en `notes`.
--
-- Limpieza (si se quiere deshacer):
--   DELETE FROM leads WHERE notes LIKE '[SEED-FASE1]%';
-- ============================================================================

BEGIN;

-- La migración 142 protege `lead_history` contra DELETE. Este seed es de
-- PRUEBA LOCAL (la guarda anti-producción de arriba lo garantiza) y necesita
-- regenerar sus propios leads, así que activa el escape SOLO dentro de esta
-- transacción. `SET LOCAL` se revierte solo al hacer COMMIT/ROLLBACK.
SET LOCAL app.permite_borrar_historial = 'on';

-- El historial es permanente (FK RESTRICT desde la migración 140) y las
-- gestiones comerciales también (migración 141): para poder regenerar los
-- leads de prueba hay que retirar primero sus eventos y gestiones. Se limita
-- explícitamente a los propios leads del seed.
DELETE FROM lead_gestiones
WHERE lead_id IN (SELECT id FROM leads WHERE notes LIKE '[SEED-FASE1]%');

DELETE FROM lead_history
WHERE lead_id IN (SELECT id FROM leads WHERE notes LIKE '[SEED-FASE1]%');

DELETE FROM leads WHERE notes LIKE '[SEED-FASE1]%';

INSERT INTO leads (
  first_name, last_name, email, phone, company_name, source,
  status, score, assigned_employee_id, notes, created_at, updated_at
)
SELECT
  -- Nombre / apellido
  'Nombre' || i,
  'Apellido' || i,

  -- Email: mezcla de formato, mayúsculas, espacios y nulos
  CASE
    WHEN i % 10 = 0              THEN NULL                      -- sin email (10%)
    WHEN i % 3  = 0              THEN '  Lead' || i || '@Demo.TEST '  -- con espacios + caja mixta
    ELSE 'lead' || i || '@demo.test'
  END,

  -- Teléfono: formatos colombianos variados + nulos
  CASE
    WHEN i % 4 = 0 THEN NULL                                    -- sin teléfono (25%)
    WHEN i % 4 = 1 THEN '30' || lpad(((i * 7919) % 100000000)::text, 8, '0')        -- 10 dígitos
    WHEN i % 4 = 2 THEN '+57 30' || lpad(((i * 7919) % 100000000)::text, 8, '0')    -- +57
    ELSE             '57' || '30' || lpad(((i * 7919) % 100000000)::text, 8, '0')   -- 57 largo
  END,

  -- Empresa: a veces con espacios y mezcla de caja
  CASE
    WHEN i % 7 = 0 THEN NULL
    WHEN i % 5 = 0 THEN '  empresa demo ' || i
    ELSE 'Empresa Demo ' || i
  END,

  -- Fuente sucia (16 variantes, incluye vacío y NULL)
  (ARRAY[
     'web', 'Web', 'WEB', 'pagina web', 'Pagina Web', 'sitio web',   -- 0..5  -> web
     'FB', 'Facebook', 'facebook', 'Meta',                            -- 6..9  -> facebook
     'Instagram', 'ig', 'whatsapp', 'WhatsApp',                       -- 10..13
     'Referido', 'recomendacion', 'Llamada', 'llamada entrante',      -- 14..17
     'Feria/Evento', 'exposicion', 'Cliente existente', 'cliente',     -- 18..21
     'Otra cosa', 'redes sociales', 'no se',                          -- 22..24 -> otro
     '',                                                              -- 25    -> vacío
     'pagina-web', 'google', 'campaña', 'llamada fria'                -- 26..29 -> web/llamada/otro
  ])[1 + (i % 30)],

  -- Estado: todos los estados del CHECK
  (ARRAY['new', 'contacted', 'qualified', 'dead', 'converted'])[1 + (i % 5)],

  -- Scoring histórico manual 0-100 (se conservará tras la migración)
  (i * 37) % 101,

  -- Responsable: 1/3 de los leads llevan empleado responsable.
  -- Nota: el OFFSET (i % 3) solo se evalúa cuando i % 3 = 0, así que en la
  -- práctica TODOS apuntan al primer usuario activo y, por tanto, al mismo
  -- empleado. Se conserva tal cual el comportamiento original: es con el que se
  -- validó la migración 138 y cambiarlo haría que los datos dejaran de coincidir.
  -- Migración 138: la asignación pasó de users.id a employees.id, siguiendo la
  -- MISMA lógica del backfill (users -> employees.user_id).
  CASE WHEN i % 3 = 0
       THEN (SELECT e.id FROM users u
             JOIN employees e ON e.user_id = u.id
             WHERE u.estado = 'ACTIVO'
             ORDER BY u.id OFFSET (i % 3) LIMIT 1)
       ELSE NULL
  END,

  -- Marca de limpieza
  '[SEED-FASE1] Lead de prueba sintético #' || i,

  -- Antigüedad distribuida en 90 días
  NOW() - (((i * 17) % 90) * INTERVAL '1 day'),
  NOW() - (((i * 17) % 90) * INTERVAL '1 day')
FROM generate_series(1, 100) AS i;

COMMIT;

-- ============================================================================
-- Duplicados sintéticos (ítem D): mismos email / teléfono / empresa que leads
-- ya sembrados, pero con formato distinto para probar la normalización.
-- Se marcan igual ([SEED-FASE1]) para que la limpieza los incluya.
-- ============================================================================
BEGIN;

-- A) Mismo email (4 filas)
INSERT INTO leads (first_name, last_name, email, phone, company_name, source, status, score, assigned_employee_id, notes, created_at, updated_at)
SELECT 'Duplico Email ' || t.rn, 'Prueba ' || t.rn, t.email,
       '30990000' || lpad(t.rn::text, 3, '0'), t.company_name,
       'Referido', 'new', 40, t.assigned_employee_id,
       '[SEED-FASE1] duplicado por email #' || t.rn, NOW(), NOW()
FROM (
  SELECT ROW_NUMBER() OVER (ORDER BY id) AS rn, email, company_name, assigned_employee_id
  FROM leads
  WHERE notes LIKE '[SEED-FASE1]%' AND email IS NOT NULL AND company_name IS NOT NULL
) AS t
WHERE t.rn <= 4;

-- B) Mismo teléfono con formato distinto ('+57 ...' vs '30...') (4 filas)
INSERT INTO leads (first_name, last_name, email, phone, company_name, source, status, score, assigned_employee_id, notes, created_at, updated_at)
SELECT 'Duplico Tel ' || t.rn, 'Prueba ' || t.rn,
       'dup.tel' || t.rn || '@demo.test',
       '+57 ' || t.digitos, t.company_name,
       'whatsapp', 'contacted', 55, t.assigned_employee_id,
       '[SEED-FASE1] duplicado por telefono #' || t.rn, NOW(), NOW()
FROM (
  SELECT ROW_NUMBER() OVER (ORDER BY id) AS rn, regexp_replace(phone, '[^0-9]', '', 'g') AS digitos,
         company_name, assigned_employee_id
  FROM leads
  WHERE notes LIKE '[SEED-FASE1]%'
    AND phone IS NOT NULL
    AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
) AS t
WHERE t.rn <= 4;

-- C) Mismo nombre de empresa en MAYÚSCULAS y con espacios (4 filas)
INSERT INTO leads (first_name, last_name, email, phone, company_name, source, status, score, assigned_employee_id, notes, created_at, updated_at)
SELECT 'Duplico Empresa ' || t.rn, 'Prueba ' || t.rn,
       'dup.emp' || t.rn || '@demo.test',
       '3088000' || lpad(t.rn::text, 4, '0'),
       '  ' || UPPER(t.company_name) || ' ',
       'web', 'new', 35, t.assigned_employee_id,
       '[SEED-FASE1] duplicado por empresa #' || t.rn, NOW(), NOW()
FROM (
  SELECT ROW_NUMBER() OVER (ORDER BY id) AS rn, company_name, assigned_employee_id
  FROM leads
  WHERE notes LIKE '[SEED-FASE1]%' AND company_name IS NOT NULL
) AS t
WHERE t.rn <= 4;

COMMIT;

-- Verificación rápida (solo lectura)
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE notes LIKE '[SEED-FASE1]%') AS sembrados
FROM leads;
