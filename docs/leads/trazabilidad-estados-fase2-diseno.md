# Fase 2 — Diseño técnico: trazabilidad de estados con nota

**Proyecto:** CRM/ERP CARGAR S.A.S. · **Módulo:** Leads · **Fecha:** 2026-10-20
**Rama prevista:** `feature/leads-trazabilidad-estados` (desde `fix/migraciones-conflicto-067`)

> Este documento NO implementa nada. Es la propuesta para el Gate 2.
> Continúa el reconocimiento aprobado en el Gate 1.

---

## 0. Resumen ejecutivo

La mayor parte de la trazabilidad **ya existe** (`lead_history`, migración 139) y ya se escribe
en los tres puntos de cambio de estado. El trabajo real de esta fase es:

1. **Añadir la nota del usuario** al evento `CAMBIO_ESTADO` (`nota TEXT`).
2. **Exigirla** en todo cambio de estado manual, en el dominio y en la API.
3. **Backfill** de los leads existentes con un registro inicial idempotente.
4. **Blindar** `lead_history` con un trigger de inmutabilidad.
5. **Calcular y mostrar** la duración por estado.
6. **UI**: modal «Cambiar estado» + modal de conversión con nota.

No se crea `lead_historial_estados`: duplicaría `lead_history` y rompería la línea de tiempo
que ya está en producción local.

---

## 1. Alcance

**Dentro:** cambios de estado de Leads, su nota, su inmutabilidad, su visualización y sus pruebas.

**Fuera:** Kanban, acciones masivas, importación, jobs automáticos, restricción por responsable
(D6 se mantiene como está: `leads.ver` ve todo), y cualquier módulo ajeno.

---

## 2. Modelo de datos

### 2.1 Migración `142_lead_historial_nota_inmutabilidad.sql`

```sql
-- =====================================================================
-- Migración 142: nota del cambio de estado e inmutabilidad del historial
-- CARGAR S.A.S. — Módulo Leads
-- =====================================================================

-- 1. Nota escrita por el usuario -------------------------------------
ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS nota TEXT;

COMMENT ON COLUMN lead_history.nota IS
  'Nota escrita por el usuario al cambiar de estado. NULL en eventos automaticos.';

-- 2. Un solo evento de creacion por lead (protege el backfill) --------
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_history_creacion
  ON lead_history (lead_id)
  WHERE event_type = 'CREACION';

-- 3. Backfill idempotente --------------------------------------------
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
  'Registro inicial (migracion): estado actual al habilitar la trazabilidad.',
  'Registro inicial (migracion)',
  NULL,
  'Migracion 142',
  jsonb_build_object('origen', 'migracion', 'estado_actual_al_migrar', true),
  l.created_at
FROM leads l
ON CONFLICT DO NOTHING;

-- 4. Inmutabilidad ----------------------------------------------------
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

  -- UPDATE: solo se permite anotar `metadata` (resultado del correo).
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

DROP TRIGGER IF EXISTS trg_lead_history_proteger ON lead_history;
CREATE TRIGGER trg_lead_history_proteger
  BEFORE UPDATE OR DELETE ON lead_history
  FOR EACH ROW EXECUTE FUNCTION lead_history_proteger();
```

**Registro en `runner.js`:** nueva entrada `'142_lead_historial_nota_inmutabilidad.sql'`
al final de `MIGRATION_FILES`.

### 2.2 Por qué `nota` y no reutilizar `description`

`description` ya lo usan los eventos automáticos (`MODIFICACION`, `ASIGNACION`, `CIERRE`) con
texto generado por el sistema. Mezclar ahí el texto del usuario haría indistinguible lo auditado
de lo narrado. `nota` queda separada, es nullable y no rompe los eventos existentes.

### 2.3 Backfill

- **Cubre todos los leads**, activos y archivados.
- Usa `l.created_at` como fecha (decisión D3), `l.status` como estado y `metadata.origen='migracion'`.
- `ON CONFLICT DO NOTHING` + índice único parcial lo hacen **idempotente y seguro ante arranque
  simultáneo de las 3 réplicas** (cada réplica ejecuta `npm run migrate` al arrancar).
- Los leads creados después de la migración ya reciben su `CREACION` real desde
  `createConHistorial`; el backfill no los toca porque ya existe su índice único.

**Honestidad del dato:** el backfill no reconstruye la historia. La UI marcará la duración de
esos eventos como «no disponible (anterior a la migración)» usando `metadata.origen`.

### 2.4 Inmutabilidad

| Operación | Resultado |
|---|---|
| `INSERT` | Permitido (es la única escritura normal) |
| `UPDATE` de cualquier campo auditado | **Excepción** `restrict_violation` |
| `UPDATE` solo de `metadata` | Permitido (anotación del correo, ya existente) |
| `DELETE` | **Excepción**, salvo `app.permite_borrar_historial = 'on'` |

La vía de escape existe **solo** para pruebas y mantenimiento (seed). La API nunca la activa.
Se documenta en el propio SQL para que no se use por accidente.

### 2.5 Rollback

```sql
DROP TRIGGER IF EXISTS trg_lead_history_proteger ON lead_history;
DROP FUNCTION IF EXISTS lead_history_proteger();
DROP INDEX IF EXISTS uq_lead_history_creacion;

SET app.permite_borrar_historial = 'on';
DELETE FROM lead_history WHERE metadata->>'origen' = 'migracion';
RESET app.permite_borrar_historial;

ALTER TABLE lead_history DROP COLUMN IF EXISTS nota;
```

El rollback **no** toca eventos reales: solo los del backfill, identificables por `metadata`.

---

## 3. Backend

### 3.1 Una sola función de escritura de estado

Hoy `CAMBIO_ESTADO` se inserta en dos sitios (`updateConHistorial` y `convertToContact`).
Se centraliza en un único método privado:

```js
// leads.repository.js
async _registrarCambioEstado(client, { leadId, estadoAnterior, estadoNuevo, nota, ctx }) {
  if (!estadoNuevo || estadoAnterior === estadoNuevo) return null;

  const base = {
    leadId,
    performedByUserId: ctx.userId || null,
    performedByName: ctx.userName || null,
  };

  const eventoId = await historyRepo.registrar({
    ...base,
    eventType: 'CAMBIO_ESTADO',
    fieldName: 'status',
    oldValue: estadoAnterior,
    newValue: estadoNuevo,
    nota: nota?.trim() || null,
    description: `Estado cambiado de "${estadoAnterior}" a "${estadoNuevo}"`,
  }, client);

  if (ESTADOS_CIERRE.includes(estadoNuevo) && !ESTADOS_CIERRE.includes(estadoAnterior)) {
    await historyRepo.registrar({
      ...base,
      eventType: 'CIERRE',
      fieldName: 'status',
      oldValue: estadoAnterior,
      newValue: estadoNuevo,
      description: `Lead cerrado en estado "${estadoNuevo}"`,
    }, client);
  }
  return eventoId;
}
```

`updateConHistorial`, `convertToContact` y cualquier futura vía pasan por aquí. La nota se guarda
**solo** en `CAMBIO_ESTADO`; `CIERRE` es un evento derivado y no la duplica.

### 3.2 Bloqueo y concurrencia

Se añade `lockById(id, client)`:

```sql
SELECT l.*, e.full_name AS assigned_employee_name
  FROM leads l
  LEFT JOIN employees e ON e.id = l.assigned_employee_id
 WHERE l.id = $1 AND l.deleted_at IS NULL
 FOR UPDATE OF l
```

`updateConHistorial` y `convertToContact` lo usan en lugar de `findById`. Así dos cambios de estado
simultáneos se serializan: el segundo lee el estado que dejó el primero y la cadena
`anterior → nuevo` queda coherente.

### 3.3 Endpoints (se reutilizan, no se crean)

| Acción | Endpoint existente | Cambio |
|---|---|---|
| Cambiar estado con nota | `PATCH /api/v1/leads/:id` con `{ status, nota }` | Se acepta `nota` y se exige si `status` cambia |
| Convertir a contacto | `PATCH /api/v1/leads/:id/convert` con `{ nota }` | Se exige `nota` (mín. 5) |
| Ver historial | `GET /api/v1/leads/:id/history` | Devuelve `nota`, `duracionSegundos`, `duracionConfiable`, `esEstadoActual` |
| Resumen | `GET /api/v1/leads/:id/summary` | Sin cambios |

No se crea `GET /leads/:id/historial-estados`: sería un alias del `/history` que ya existe.

### 3.4 Validación y permisos

- **Zod** (`leads.schema.js`):
  - `updateLeadSchema`: `nota` opcional, `trim`, máx. 1000.
  - `convertLeadSchema`: `nota` obligatoria, `trim`, mín. 5, máx. 1000.
- **Dominio** (`leads.repository.js`): `validarNotaCambioEstado(nota, anterior, nuevo)` lanza
  `ValidationError` (422) si el estado cambia y la nota tiene menos de 5 caracteres. Es la
  **fuente de verdad**: protege también llamadas internas y scripts.
- **Permisos:** sin cambios. `PATCH` → `leads.editar`; `convert` → `leads.editar`;
  `GET /history` → `leads.ver`. Admin sigue haciendo bypass.
- **Salida:** React escapa por defecto; no se usa `dangerouslySetInnerHTML`.
- **SQL:** todo parametrizado. La nota nunca se interpola.

### 3.5 Duración por estado

En `findEvents` se añade un CTE sobre las **entradas de estado** (no sobre todas las
modificaciones, que no cambian el estado):

```sql
WITH entradas AS (
  SELECT id, created_at,
         LEAD(created_at) OVER (ORDER BY created_at, id) AS siguiente
    FROM lead_history
   WHERE lead_id = $1
     AND event_type IN ('CREACION', 'CAMBIO_ESTADO')
)
```

Por cada evento de estado:

- `duracion_segundos` = `siguiente - created_at`; si no hay siguiente, `now() - created_at`.
- `es_estado_actual` = no hay siguiente.
- `duracion_confiable` = `false` si `metadata->>'origen' = 'migracion'`; `true` en el resto.

Los eventos de gestión devuelven estos campos en `NULL`.

### 3.6 Archivos backend

| Archivo | Cambio |
|---|---|
| `backend/migrations/142_lead_historial_nota_inmutabilidad.sql` | **Nuevo** |
| `backend/migrations/runner.js` | Añadir 142 + guardia de numeración (ver §5) |
| `backend/src/modules/leads/leadsHistory.repository.js` | `nota` en `registrar`, duraciones y `nota` en `findEvents`, mapeo |
| `backend/src/modules/leads/leads.repository.js` | `lockById`, `_registrarCambioEstado`, validación de nota, `convertToContact` con nota |
| `backend/src/modules/leads/leads.schema.js` | `nota` en update y `convertLeadSchema` |
| `backend/src/modules/leads/leads.routes.js` | `validate(convertLeadSchema)` en `/convert` |
| `backend/src/modules/leads/leads.controller.js` | Pasar `nota` a `convertToContact` |
| `backend/seeds/leads_fase1_prueba.sql` | Escape de borrado antes de limpiar (`SET app.permite_borrar_historial`) |

---

## 4. Frontend

### 4.1 Modal «Cambiar estado»

Nuevo `CambiarEstadoModal.jsx`:

- Select con `new`, `contacted`, `qualified`, `dead` (se excluye `converted`: para eso está la
  conversión, que crea contacto y empresa).
- La opción del estado actual queda deshabilitada.
- `textarea` **obligatorio**, mínimo 5, máximo 1000, con contador.
- Envía `PATCH /leads/:id` con `{ status, nota }`.
- Invalida `leads`, `lead`, `lead-history`, `lead-summary`; toast de éxito.

### 4.2 Modal de conversión

Nuevo `ConvertirLeadModal.jsx`: pide la nota (obligatoria) y llama a
`PATCH /leads/:id/convert` con `{ nota }`. Sustituye el `window.confirm` actual.

### 4.3 Formulario de edición

`LeadForm.jsx`: al **editar**, se retira el selector de estado y se muestra un chip de solo lectura
con la pista «El estado se cambia con “Cambiar estado”, que exige una nota». El payload sigue
enviando el estado actual (sin cambio) para no disparar la validación. Al **crear**, el selector
se mantiene (decisión D2: el estado inicial se registra como `CREACION`).

### 4.4 Línea de tiempo

`LeadHistoryTimeline.jsx`:

- Muestra `nota` destacada bajo la descripción del sistema.
- Muestra la duración: «En este estado: 3 d 4 h» / «Duración en el estado: 2 h 15 min».
- Si `duracionConfiable === false`: «Duración no disponible (anterior a la migración)».
- Los eventos de gestión siguen sin duración.

### 4.5 Integración en los puntos de entrada

| Punto | Antes | Después |
|---|---|---|
| Listado, acción «Convertir» | `window.confirm` | `ConvertirLeadModal` |
| Listado, nueva acción «Cambiar estado» | — | `CambiarEstadoModal` |
| Detalle, cabecera | — | Botón «Cambiar estado» + modal |
| Modal Editar | Selector de estado | Chip informativo (sin cambio de estado) |
| Creación | Selector de estado | Sin cambios (estado inicial) |

### 4.6 Archivos frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/components/Leads/CambiarEstadoModal.jsx` | **Nuevo** |
| `frontend/src/components/Leads/ConvertirLeadModal.jsx` | **Nuevo** |
| `frontend/src/components/Leads/LeadForm.jsx` | Estado solo lectura al editar |
| `frontend/src/components/Leads/LeadHistoryTimeline.jsx` | Nota + duración |
| `frontend/src/pages/Leads/LeadsPage.jsx` | Modales de estado y conversión |
| `frontend/src/pages/Leads/LeadDetailPage.jsx` | Botón y modal de estado |
| `frontend/src/constants/leads.js` | `ESTADOS_LEAD` y formateo de duración |

---

## 5. Punto 8: colisiones 076 y 129

**Hallazgo verificado:** los cuatro archivos **ya están aplicados** y registrados por nombre en
`_migrations` (076: ids 70 y 79; 129: ids 134 y 137). El runner identifica las migraciones por
`filename`, no por número.

**Decisión: NO renombrar.** Renombrar un archivo ya aplicado haría que el runner lo tratara como
nuevo y lo re-ejecutara contra producción: riesgo real de datos y de fallos.

**Acción profesional (en `runner.js`, Fase 3):**

1. Constante `COLISIONES_HISTORICAS = new Set(['076', '129'])` con comentario explicativo.
2. Guardia al arrancar: si aparece una colisión **nueva**, el runner aborta **antes de conectar**
   con un mensaje que indica renombrar la migración nueva (aún no aplicada).
3. Aviso informativo (no bloqueante) para las dos colisiones históricas conocidas.
4. Comentario en el archivo: «Nunca renombrar una migración ya aplicada».

Esto deja el histórico intacto y evita que vuelva a ocurrir.

---

## 6. Plan de pruebas

### 6.1 Nuevas (integración real contra BD)

| # | Caso | Esperado |
|---|---|---|
| N1 | Crear lead | `CREACION` con estado, usuario y fecha |
| N2 | Cambiar estado con nota | `CAMBIO_ESTADO` con anterior, nuevo, nota, usuario y fecha |
| N3 | Cambiar estado sin nota | 422 con mensaje claro |
| N4 | Nota de 4 caracteres | 422 |
| N5 | Mismo estado | Sin evento (idempotente) |
| N6 | Fallo del INSERT de historial | El estado **no** cambia (rollback) |
| N7 | Dos cambios simultáneos | Ambos registrados y encadenados |
| N8 | Convertir con nota | `CAMBIO_ESTADO` + `CIERRE` con nota |
| N9 | Convertir sin nota | 422 |
| N10 | `UPDATE`/`DELETE` de historial por SQL | Excepción `restrict_violation` |
| N11 | `UPDATE` solo de `metadata` | Permitido |
| N12 | Usuario sin `leads.editar` | 403 al cambiar estado |
| N13 | Usuario sin `leads.ver` | 403 al consultar historial |
| N14 | Nota con `'; DROP TABLE lead_history; --` y `<script>` | Se guarda literal; la tabla sigue; React escapa |
| N15 | Backfill | Todos los leads tienen `CREACION`; re-ejecutar no duplica |
| N16 | Duración | Orden correcto; estado actual sin `siguiente`; migración no confiable |
| N17 | Timeline en America/Bogota | Fecha y hora correctas |

### 6.2 Regresión

- Las **80 pruebas actuales de Leads** deben seguir pasando (con las actualizaciones de firma
  que exige la nota).
- Suite completa: se compara contra la línea base medida (**130/154**; 24 fallos preexistentes
  de `horasExtras`, ajenos a Leads).
- Chequeo de migraciones huérfanas: sin resultados.

### 6.3 Archivos de prueba

| Archivo | Cambio |
|---|---|
| `backend/src/modules/leads/__tests__/leadsHistory.integration.test.js` | Añadir nota en los 7 cambios de estado; escape de borrado; nuevos casos N1–N17 |
| `backend/src/modules/leads/__tests__/leads.asignacion.test.js` | Casos de 403/422 de nota en API |
| `backend/src/modules/leads/__tests__/leadsEstado.test.js` | **Nuevo**: unidad de validación de nota y duración |

---

## 7. Plan de migración y despliegue

1. **Local:** aplicar 142 con `npm run migrate`; verificar columnas, índice, trigger y backfill.
2. **Re-ejecutar** el runner: debe decir «ya está al día» (idempotencia).
3. **Respaldo de producción** (`pg_dump`) **antes** de desplegar.
4. **Pruebas en staging** con una copia de producción.
5. **Despliegue en Dokploy** (manual). El contenedor ejecuta `npm run migrate && node src/app.js`.
6. **Verificar las 3 réplicas:** que las tres respondan con el código nuevo (`/health` o el
   endpoint de historial devolviendo `nota`) antes de dar el despliegue por bueno.
7. **Rollback:** §2.5 + redeploy de la imagen anterior.

**Sin push ni despliegue hasta autorización explícita.**

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Trigger `DELETE` rompe pruebas y seed | Escape `app.permite_borrar_historial` documentado y usado solo ahí |
| Trigger `UPDATE` rompe la anotación del correo | Se permite `UPDATE` de `metadata`; el resto queda bloqueado |
| Arranque simultáneo de 3 réplicas duplicando backfill | Índice único parcial + `ON CONFLICT DO NOTHING` |
| Clientes API que cambian estado sin nota | 422 explícito; el frontend se actualiza en la misma entrega |
| Conversión sin nota (cambio de contrato) | Se actualiza el frontend; es el único cliente |
| Duraciones falsas antes de la migración | `duracionConfiable=false` y texto explícito en la UI |
| `nota` con HTML/scripts | Se guarda literal y React escapa; no hay `innerHTML` |
| Migración ya aplicada renombrada | Prohibido por guardia + comentario en `runner.js` |

---

## 9. Decisiones cerradas

| # | Decisión |
|---|---|
| D1 | Nota obligatoria, mínimo 5 caracteres, en todo cambio de estado manual |
| D2 | El estado inicial ya se registra como `CREACION` (sin cambios) |
| D3 | Backfill con un `CREACION` por lead, fecha `created_at`, `metadata.origen='migracion'` |
| D4 | Inmutable: trigger bloquea `UPDATE` auditado y `DELETE`; solo `metadata` editable |
| D5 | Ya resuelto por `lead_gestiones`; no se toca |
| D6 | Se mantiene `leads.ver` para todos; no se introduce restricción por responsable |
| D7 | Duración por estado calculada con `LEAD()` y mostrada en la línea de tiempo |
| Extra | Conversión también exige nota |
| Extra | No se crea tabla nueva ni endpoint de historial nuevo |

---

## 10. Resumen de archivos

**Nuevos (3):**
- `backend/migrations/142_lead_historial_nota_inmutabilidad.sql`
- `frontend/src/components/Leads/CambiarEstadoModal.jsx`
- `frontend/src/components/Leads/ConvertirLeadModal.jsx`

**Modificados — dentro de Leads (8):**
- `backend/src/modules/leads/leads.repository.js`
- `backend/src/modules/leads/leadsHistory.repository.js`
- `backend/src/modules/leads/leads.controller.js`
- `backend/src/modules/leads/leads.schema.js`
- `backend/src/modules/leads/leads.routes.js`
- `frontend/src/components/Leads/LeadForm.jsx`
- `frontend/src/components/Leads/LeadHistoryTimeline.jsx`
- `frontend/src/pages/Leads/LeadsPage.jsx`
- `frontend/src/pages/Leads/LeadDetailPage.jsx`
- `frontend/src/constants/leads.js`

**Modificados — fuera de Leads (3, autorizados):**
- `backend/migrations/runner.js` — alta de 142 + guardia de numeración (§5)
- `backend/seeds/leads_fase1_prueba.sql` — escape de borrado del historial de pruebas
- `backend/src/modules/leads/__tests__/*` — actualización y casos nuevos

---

**STOP — Gate 2.** No he creado la rama ni modificado código. Quedo a la espera de tu «aprobado»
para implementar la Fase 3.
