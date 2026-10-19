# Fase 3 — Historial y trazabilidad de Leads

**Proyecto:** CRM/ERP CARGAR S.A.S. · **Fecha:** 2026-10-19
**Alcance:** línea de tiempo del ciclo de vida de cada Lead + vista de detalle.

> Continúa la Fase 2 (asignación a empleados y notificación por correo), que sigue intacta.

---

## 1. Resumen técnico

Se añadió una tabla de eventos `lead_history`, se escriben los eventos **dentro de la misma
transacción** que modifica el lead, y se creó la ruta `/leads/:id` con las pestañas
**Resumen**, **Historial / Trazabilidad** y **Editar**.

### Por qué no se reutilizaron las tablas existentes

Verificado sobre la copia local antes de decidir:

| Tabla | Qué es | Por qué no sirve para la línea de tiempo |
|---|---|---|
| `audit_logs` | Auditoría de seguridad, 2 854 filas, ya cubre `/api/v1/leads` | Corre en el evento `finish` (fuera de transacción, *fire-and-forget*), `datos_antes` guarda el **body nuevo**, `datos_despues` es **siempre `NULL`**, y no tiene `lead_id` (identifica el lead por `ruta`). Se consulta solo con `soloAdmin`. |
| `activity_log` | Historial general, 7 377 filas, `ref_type`/`ref_id` | Guarda texto libre (`"113"`, `"OSCAR MONCAYO BEDOYA"`); le faltan `field_name`, `old_value`, `new_value`, `assigned_employee_id` y `metadata`; y **no tiene índice sobre `ref_type`/`ref_id`**. |

Sí se siguieron los precedentes del proyecto: `opportunity_stage_history`
(`from_stage_id`/`to_stage_id`/`changed_by`) y `equipos_historial_estado`.

### Verificación de que nada más escribe en `leads`

Sin triggers, sin funciones y sin otros módulos que escriban directo. Los 4 sitios de
escritura (create, update, convert, delete) están en `leads.repository.js`, lo que hizo
viable la atomicidad.

---

## 2. Archivos

### Creados

| Archivo | Propósito |
|---|---|
| `backend/migrations/139_lead_history.sql` | Tabla de eventos + 3 índices |
| `backend/src/modules/leads/leadsHistory.repository.js` | Escritura transaccional, diff, línea de tiempo, resumen |
| `backend/src/modules/leads/leadsHistory.schema.js` | Filtros por tipo y rango de fechas |
| `backend/src/modules/leads/leadsHistory.controller.js` | `GET /history` y `GET /summary` |
| `backend/src/modules/leads/__tests__/leadsHistory.integration.test.js` | 15 pruebas contra PostgreSQL real |
| `frontend/src/pages/Leads/LeadDetailPage.jsx` | Vista de detalle con pestañas |
| `frontend/src/components/Leads/LeadHistoryTimeline.jsx` | Línea de tiempo vertical |
| `frontend/src/components/Leads/LeadLifecycleSummary.jsx` | Indicadores de cabecera |

### Modificados

| Archivo | Cambio |
|---|---|
| `backend/migrations/runner.js` | Alta de la 139 |
| `backend/src/modules/leads/leads.repository.js` | `create`/`update` aceptan cliente; `createConHistorial`, `updateConHistorial`, `convertToContact` transaccional; `diffLead` |
| `backend/src/modules/leads/leads.controller.js` | Usa los métodos transacionales y anota el resultado del correo |
| `backend/src/modules/leads/leads.routes.js` | 2 rutas de solo lectura |
| `frontend/src/App.jsx` | Ruta `/leads/:id` |
| `frontend/src/pages/Leads/LeadsPage.jsx` | El nombre del lead abre el detalle; `STATUS_COLORS` importado de constants |
| `frontend/src/constants/leads.js` | Exporta `STATUS_COLORS` (antes duplicada en la página) |
| `backend/src/services/leadAsignadoNotifier.js` | El correo ahora enlaza **directo al lead** |

**No se tocó ningún módulo ajeno.** Los demás archivos de `git status` (Informes,
`backupService.js`, `gestionHumana.test.js`) son trabajo tuyo sin confirmar, intacto.

---

## 3. Migración SQL

**`139_lead_history.sql`**, registrada en `MIGRATION_FILES`, idempotente y aplicada.

```sql
lead_history (
  id                     BIGSERIAL PK,
  lead_id                UUID NOT NULL FK → leads(id) ON DELETE CASCADE,
  event_type             VARCHAR(40) NOT NULL CHECK en
                         (CREACION, ASIGNACION, CAMBIO_ESTADO, MODIFICACION, CIERRE, ACTIVIDAD),
  field_name             VARCHAR(80),
  old_value              TEXT,
  new_value              TEXT,
  description            TEXT,
  performed_by_user_id   UUID,
  performed_by_name      VARCHAR(160),   -- denormalizado a propósito
  assigned_employee_id   UUID,
  assigned_employee_name VARCHAR(160),   -- denormalizado a propósito
  metadata               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

**Índices:** `(lead_id, created_at DESC, id DESC)` para la línea de tiempo;
`(lead_id, event_type, created_at DESC)` para el filtro por tipo;
`(lead_id, created_at)` para el rango de fechas.

Los nombres van denormalizados para que un evento siga siendo comprensible aunque el
empleado o el usuario se desactiven o se eliminen.

---

## 4. Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/v1/leads/:id/history` | `leads.ver` |
| GET | `/api/v1/leads/:id/summary` | `leads.ver` |

`history` soporta `?tipo=`, `?desde=`, `?hasta=`, `?limit=`, `?cursorFecha=`, `?cursorOrden=`.
El orden es `fecha DESC, id DESC` (criterio secundario estable) y la paginación es por cursor.

**El historial es de solo lectura por diseño:** no existe ningún endpoint de escritura ni
borrado, lo que cumple "impedir que usuarios comunes modifiquen o eliminen el historial".
Hay una prueba que verifica que `POST`/`PUT`/`PATCH`/`DELETE` sobre `/history` responden 404.

---

## 5. Interfaz

**Ruta nueva `/leads/:id`** (seguir el patrón de `CompanyDetailPage`). Contenido verificable:

- **Cabecera** con el estado del lead y la tarjeta del ciclo de vida: fecha de creación,
  primera asignación, responsable actual, estado actual, última modificación y última
  gestión comercial. Cuando un dato no tiene fuente real muestra **"No disponible"**.
- **Pestaña Resumen** con los campos comerciales.
- **Pestaña Historial / Trazabilidad**: línea de tiempo vertical con conector, punto de
  color por tipo de evento, icono distinto para cada tipo, fecha en `America/Bogota`,
  valor anterior tachado en rojo → valor nuevo en verde, usuario responsable, empleado,
  y el resultado del correo cuando está disponible. Incluye filtros por tipo y rango de
  fechas, "Cargar eventos anteriores", y estados de carga, vacío y error.
- **Pestaña Editar** con el formulario existente.

El listado enlaza al detalle desde el nombre del lead.

**Verificación del frontend:** `npm run build --workspace=frontend` compila sin errores
(4 146 módulos transformados).

---

## 6. Pruebas ejecutadas

### Integración contra PostgreSQL real — 15/15

Estas verifican garantías que un mock **no** puede demostrar:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Creación registra `CREACION` con el usuario | ✔ |
| 2 | Primera asignación registra `ASIGNACION` con el empleado | ✔ |
| 4 | Cambio de estado con valor anterior y nuevo | ✔ |
| 5 | Varios campos → un evento por campo, el estado aparte | ✔ |
| 6 | Guardar sin cambios reales → **cero eventos** | ✔ |
| 5b | Estado `dead` genera además `CIERRE` | ✔ |
| 7 | El nombre del empleado queda guardado históricamente | ✔ |
| 8 | Orden descendente correcto | ✔ |
| 10 | **Dos actualizaciones concurrentes no pierden eventos** | ✔ |
| 11 | **Si la auditoría falla, la modificación se revierte** | ✔ |
| 12 | Lead antiguo sin historial → lista vacía, sin errores | ✔ |
| — | Filtro por rango de fechas | ✔ |
| — | 3 pruebas unitarias de `diffLead` | ✔ |

La prueba 11 instala un trigger que lanza una excepción sobre `lead_history`, ejecuta una
modificación y comprueba que **el teléfono y el estado del lead quedan intactos** y que no
queda ningún evento huérfano.

Tiene guarda anti-producción: solo se ejecuta si el nombre de la base contiene
`prueba|test|dev|local|sandbox|tmp`; si no, se omite con aviso.

### API — 24/24

Los 12 escenarios de la Fase 2 siguen en verde, más 8 del historial: paginación, filtros,
tipo inválido (422), lead inexistente (404), resumen de lead sin historial, sin permisos
(403), **ausencia de endpoints de escritura**, y anotación del resultado del correo.

### Regresiones

`audit.middleware`, `servicios` y `remisionSustitucion` siguen en verde.
**83 pruebas en verde** en el total relevante (antes 74).

Sigue fallando lo mismo que antes de este cambio y sin relación con Leads:
`horasExtras` (24 fallos de la lógica de horas), `informes/gestionHumana.test.js` y
`email-marketing/emailMarketing.service.test.js` (estas dos no cargan `.env` y hacen
`process.exit(1)`).

---

## 7. Limitaciones y puntos abiertos

1. **No hay "prioridad", "fecha de seguimiento" ni "motivo de cierre" en `leads`.** Por
   eso las secciones 3D y 3F del pedido quedan cubiertas solo con los campos que existen,
   y "cierre" se deriva del paso a `dead` o `converted`. No se inventaron datos.

2. **"Última gestión comercial" se calcula del último evento no-creación.** Hoy es el
   mejor dato disponible; no existe un módulo de seguimiento comercial que lo aporte.

3. **La integración con `tasks` no muestra nada todavía.** `tasks` tiene
   `related_type`/`related_id`, pero sus 3 filas tienen `related_type` a `NULL` y **cero
   referencian leads**. La consulta está implementada (sin duplicar el módulo), así que
   aparecerán solas en cuanto se empiecen a vincular. No tiene índice sobre
   `(related_type, related_id)` y no lo añadí para no tocar un módulo ajeno.

4. **`ON DELETE CASCADE` sobre `lead_history.lead_id`.** Al borrar un lead se borra su
   historial. Se eligió así para no romper `DELETE /api/v1/leads/:id`. Si prefieres
   conservar la trazabilidad aunque el lead se elimine, habría que pasar a `SET NULL`.

5. **Los leads anteriores a esta fase no tienen historial retroactivo.** Se distingue
   explícitamente en la API (`tieneHistorial: false`) para no presentar datos
   reconstruidos como auditados. `audit_logs` sí tiene 8 eventos previos de leads, pero
   como guardan el body nuevo y no el diff, no se integraron para no dar una imagen falsa.

6. **`npm test` del backend sigue roto** (llama a `backend/node_modules/.bin/jest`, pero
   Jest está hoisted a la raíz). Preexistente y no introducido aquí; lo ejecuté por la
   ruta real.

7. **`DROP COLUMN assigned_to` de la migración 138 sigue pendiente de tu respaldo.**
   Antes de desplegar a producción conviene `pg_dump -t leads`.

---

## 8. Cómo verificarlo a mano

```bash
# Tras crear o editar un lead:
GET /api/v1/leads/<id>/summary
GET /api/v1/leads/<id>/history
GET /api/v1/leads/<id>/history?tipo=ASIGNACION&desde=2026-10-01&hasta=2026-10-31

# El historial no se puede escribir ni borrar:
POST   /api/v1/leads/<id>/history        -> 404
DELETE /api/v1/leads/<id>/history/1      -> 404

# Revisar en el navegador:
#   /leads            -> el nombre del lead abre el detalle
#   /leads/<id>       -> pestañas Resumen | Historial / Trazabilidad | Editar
```
