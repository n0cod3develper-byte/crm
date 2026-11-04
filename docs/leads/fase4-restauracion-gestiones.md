# Fase 4 — Restauración de archivados y gestión comercial de Leads

**Proyecto:** CRM/ERP CARGAR S.A.S. · **Fecha:** 2026-10-19
**Alcance:** recuperar leads archivados + registrar y consultar gestiones comerciales reales.

> Continúa la Fase 3 (historial y trazabilidad) y el borrado lógico de la migración 140.
> La Fase 2 (asignación a empleados y notificación por correo) **sigue intacta y no se
> modifica su comportamiento**.

---

## 1. Restauración de Leads archivados

### 1.1 Endpoint

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/api/v1/leads/:id/restaurar` | `leads` / **`eliminar`** |
| `GET` | `/api/v1/leads?archivados=true` | `leads` / `ver` |

**Decisión de permiso:** restaurar usa `verificarPermiso('leads', 'eliminar')`, el mismo
que archivar, porque es su inverso exacto. No se creó un permiso nuevo, por lo que no se
tocó `roles_permisos` ni `modulos_sistema`.

Verificado en la BD: el módulo `Leads` ya está configurado y `puede_eliminar` lo tienen
Administrador, Facturador, Mantenimiento y Mercadeo; no lo tienen Contabilidad, Gerencia
ni Gestión Humana. Archivar y restaurar quedan así con exactamente el mismo público.

### 1.2 Comportamiento

- Solo un lead con `deleted_at NOT NULL` puede restaurarse. Si no, responde `404`.
- Se limpian `deleted_at`, `deleted_by` y `deleted_by_name`. **No se tocan** `status`,
  `assigned_employee_id` ni ningún otro campo: el lead vuelve con el mismo responsable y
  el mismo estado que tenía al archivarse.
- Se registra el evento `RESTAURACION` en `lead_history`, con el nombre del usuario y un
  `metadata` que deja constancia de lo conservado:

```json
{
  "estado_anterior": "qualified",
  "estado_actual": "qualified",
  "empleado_anterior": "YESID CANO",
  "empleado_actual": "YESID CANO",
  "archivado_en": "2026-10-19T17:09:47.123Z"
}
```

- **No envía correo de asignación.** El único correo del módulo lo dispara el controlador
  cuando cambia `assigned_employee_id` vía `PATCH`. `restaurar` es un `UPDATE` dedicado
  que no pasa por esa ruta y además no modifica el responsable. Hay una prueba de API que
  verifica que `sendMailWithRetry` y `registrarNotificacion` **no** se invocan.

### 1.3 Vista de archivados

`findAll` acepta el parámetro `archivados`. Por defecto sigue excluyendo los archivados
(igual que hasta ahora); con `archivados=true` selecciona **solo** los archivados y ordena
por fecha de archivado descendente.

Se añadió `leads.deleted_by_name` (migración 141). Motivo: `deleted_by` es un UUID **sin
foreign key**, porque es auditoría inmutable; un `JOIN` a `users` perdería el nombre si el
usuario se elimina. El nombre va denormalizado, igual que `performed_by_name` y
`assigned_employee_name` en `lead_history`.

En la interfaz:

- Botón **«Ver archivados» / «Ver activos»** en la cabecera de `/leads`.
- Columna **Archivado** con fecha y usuario responsable del archivado.
- Botón **Restaurar**, visible solo para quien tiene `puede_eliminar`.
- En el detalle del lead aparece la insignia «Archivado el 19 oct 2026, 5:09 p. m. por …».

### 1.4 Garantía transaccional

`restaurar` corre dentro de `withTransaction`. Si el `INSERT` en `lead_history` falla, el
`UPDATE` de `leads` **se revierte completo**: nunca queda un lead restaurado sin su
evento. La prueba **R7** lo demuestra forzando el fallo con un `CHECK` temporal que
prohíbe `event_type = 'RESTAURACION'`, verificando que el lead sigue archivado y sin
evento huérfano, y que el mismo `restore` funciona una vez levantada la restricción.

---

## 2. Gestión comercial

### 2.1 Análisis previo: ¿reutilizar `tasks`?

Se analizó la tabla `tasks` antes de decidir, como se pidió. **Encaja en parte:**

| Requisito | `tasks` |
|---|---|
| Llamadas / reuniones / correos / seguimientos | su `CHECK` de `type` ya trae `call`, `meeting`, `email`, `follow_up` |
| Vinculación al lead | `related_type` / `related_id` ya existen |
| Aparición en la línea de tiempo | la Fase 3 ya hacía `UNION` con `tasks` |

**Pero no sirve como almacén:**

1. **`tasks.assigned_to` apunta a `users(id)`, no a `employees`.** La Fase 2 asignó leads a
   *empleados* precisamente porque solo 8 de 17 empleados tienen cuenta de usuario.
   «Empleado que realizó la gestión» fallaría para 9 de ellos.
2. **No tiene campo de resultado.**
3. **No tiene fecha/hora de la gestión**, solo `created_at` (cuándo se registró, no cuándo
   ocurrió).
4. **Oculta actividades entre usuarios.** `TasksRepository.findAll` filtra
   `assigned_to = yo OR created_by = yo OR supervisor_id = yo` en no-admins, así que un
   gerente no vería las gestiones del vendedor dentro del lead.
5. **Semántica incompatible.** `tasks` modela «tarea pendiente» (`priority`, `due_date`,
   `completed_at`, `is_favorite`, `estimated_minutes`). Una gestión comercial es un **hecho
   histórico cerrado**.

Además `tasks` tiene 3 filas y **ninguna relacionada con leads**, así que no hay datos
legados que migrar. **El módulo Tasks no se tocó.**

**Decisión (aprobada):** tabla propia `lead_gestiones`, reutilizando el *catálogo de tipos*
de `tasks` para que el lenguaje sea el mismo en todo el CRM.

### 2.2 Esquema

```sql
CREATE TABLE lead_gestiones (
  id                  BIGSERIAL PRIMARY KEY,
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  tipo                VARCHAR(30) NOT NULL
                        CHECK (tipo IN ('llamada','reunion','correo','observacion','otro')),
  observaciones       TEXT,
  resultado           VARCHAR(120),
  fecha_gestion       TIMESTAMPTZ NOT NULL DEFAULT now(),   -- cuándo OCURRIÓ
  proxima_seguimiento TIMESTAMPTZ,
  employee_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name       VARCHAR(160),   -- denormalizado: auditoría permanente
  created_by          UUID,
  created_by_name     VARCHAR(160),   -- denormalizado: auditoría permanente
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Se mantienen los criterios ya adoptados en Fase 2 y 3:

- `employee_id` → **`employees`**, igual que `assigned_employee_id`.
- Nombres denormalizados, para conservar la auditoría aunque el empleado se desactive.
- `lead_id` es **`RESTRICT`**: las gestiones son parte de la trazabilidad y no se pueden
  destruir borrando el lead (prueba **R8**).

### 2.3 Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/api/v1/leads/:id/gestiones` | `leads` / `ver` |
| `POST` | `/api/v1/leads/:id/gestiones` | `leads` / `crear` |

- Filtros: `tipo`, `desde`, `hasta`, `limit`, `cursorFecha`, `cursorId`.
- El nombre del empleado **nunca llega del cliente**: el controlador lo resuelve en el
  servidor con `findEmpleadoAsignable` y rechaza empleados inactivos.
- Registrar una gestión **no dispara correo de asignación**: no cambia el responsable.
- Un lead **archivado no admite gestiones nuevas** (`422` con mensaje que invita a
  restaurarlo). Su historial de gestiones **sí sigue siendo consultable**.

### 2.4 Integración con la línea de tiempo y el resumen

- `findEvents` ahora hace `UNION` con `lead_gestiones` en lugar de con `tasks`, usando la
  **fecha de ocurrencia** (`fecha_gestion`) y mostrando tipo, resultado, empleado, usuario
  y próxima fecha de seguimiento.
- `findSummary.ultima_gestion` = `MAX(fecha_gestion)` sobre `lead_gestiones`. Deja de leer
  `lead_history`, con lo que una modificación, una reasignación o un correo **ya no pueden
  contar como gestión comercial**.
- Se añadió `total_gestiones` y `total_eventos` ahora suma auditoría + gestiones.

---

## 3. Archivos

### Creados

| Archivo | Propósito |
|---|---|
| `backend/migrations/141_lead_gestiones.sql` | `RESTAURACION` en el `CHECK`, `leads.deleted_by_name`, tabla `lead_gestiones` + 2 índices |
| `backend/src/modules/leads/leadGestiones.repository.js` | CRUD de gestiones, última gestión, conteo |
| `backend/src/modules/leads/leadGestiones.schema.js` | Validación zod de alta y de filtros |
| `backend/src/modules/leads/leadGestiones.controller.js` | `GET`/`POST` de gestiones |
| `frontend/src/components/Leads/LeadGestiones.jsx` | Lista, filtros y formulario de gestiones |

### Modificados

| Archivo | Cambio |
|---|---|
| `backend/migrations/runner.js` | Alta de la 141 |
| `backend/src/modules/leads/leads.repository.js` | `restaurar()`, `findAll({ archivados })`, `delete()` guarda `deleted_by_name` |
| `backend/src/modules/leads/leads.controller.js` | `restore()`, filtro `archivados` en `list()` |
| `backend/src/modules/leads/leads.routes.js` | `POST /:id/restaurar`, `GET`/`POST /:id/gestiones` |
| `backend/src/modules/leads/leads.schema.js` | `archivados` en el esquema de listado |
| `backend/src/modules/leads/leadsHistory.repository.js` | Rama de gestiones desde `lead_gestiones`; `ultima_gestion` y `total_gestiones` |
| `backend/src/modules/leads/leadsHistory.schema.js` | `RESTAURACION` en `TIPOS_EVENTO` |
| `backend/seeds/leads_fase1_prueba.sql` | Limpia `lead_gestiones` antes que `leads` (FK `RESTRICT`) |
| `frontend/src/constants/leads.js` | `TIPOS_GESTION` |
| `frontend/src/pages/Leads/LeadsPage.jsx` | Vista de archivados, restaurar |
| `frontend/src/pages/Leads/LeadDetailPage.jsx` | Pestaña «Gestiones comerciales», insignia y botón de restaurar |

---

## 4. Pruebas

**80 pruebas en verde** en el módulo Leads (antes de esta ronda: 53).

| Suite | Antes | Ahora | Qué se añadió |
|---|---|---|---|
| `leadsHistory.integration.test.js` | 24 | 37 | G1–G5 (gestiones), R1–R8 (restauración) |
| `leads.asignacion.test.js` | 29 | 43 | 14 pruebas de API (permisos, 403, 422, sin correo) |

Garantías verificadas:

| # | Garantía | Cómo se prueba |
|---|---|---|
| G1 | La gestión se asocia al lead y entra a la línea de tiempo | `G1` |
| G2 | La última gestión se calcula **solo** de gestiones reales | `G2` (modificaciones → `NULL`) |
| G3 | La fecha es la de **ocurrencia**, no la de registro | `G3` (7 días de diferencia) |
| G4 | Filtros por tipo, rango y paginación | `G4` |
| G5 | Las gestiones **no se destruyen** al archivar | `G5` |
| R1 | `RESTAURACION` registrado y vuelve al listado | `R1` |
| R2 | Conserva estado y responsable | `R2` |
| R3 | Un lead no archivado → `null` | `R3` |
| R4 | El historial **completo** se conserva | `R4` (íntegros por id) |
| R5 | Cadenas repetidas de archivar/restaurar | `R5` (3 ciclos) |
| R6 | La vista de archivados muestra fecha y usuario | `R6` |
| R7 | **Atómico**: si falla el evento, se revierte el restore | `R7` (`CHECK` temporal) |
| R8 | **`RESTRICT`**: no se puede borrar físicamente el lead | `R8` (`23503`) |
| API | RBAC 403, 404, 422, **sin correo** al restaurar y al registrar gestión | 14 pruebas |

---

## 5. Migración

**`141_lead_gestiones.sql`** — registrada en `MIGRATION_FILES` de `runner.js` y **ya
aplicada** en `prueba_restore`. Verificado que el archivo se puede re-ejecutar a mano sin
errores (idempotente): `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS` y `DROP CONSTRAINT IF EXISTS` previo.

**Ningún dato existente se modifica ni se elimina.** Es puramente aditiva, salvo el
`CHECK` de `lead_history`, que se relaja para aceptar un valor nuevo.

---

## 6. Riesgos y decisiones pendientes

1. **Un lead archivado no admite gestiones nuevas.** Es una decisión propia, no un
   requisito explícito: refuerza que «archivado» significa fuera del pipeline comercial.
   Es fácil de revertir si prefieres permitirlo.
2. **`tasks` quedó sin usar para leads.** Si en el futuro quieres que las tareas generen
   recordatorios de seguimiento, habría que decidir si `lead_gestiones` apunta a un
   recordatorio o si se crea la relación.
3. **`proxima_seguimiento` no genera notificaciones.** Solo se guarda y se muestra; no hay
   job que avise. Está fuera del alcance acordado.
4. **Despliegue:** falta el `pg_dump` de producción y las pruebas en staging, ambos
   requisitos obligatorios antes de desplegar.
