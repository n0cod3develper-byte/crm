# Fase 2 — Asignación de Leads a empleados y notificación por correo

**Proyecto:** CRM/ERP CARGAR S.A.S. · **Fecha:** 2026-10-19
**Alcance:** asignar leads a empleados del módulo `employees` + aviso automático por correo.

> Esta fase implementa la asignación de leads y su notificación. No incluye los demás
> puntos del diseño de la Fase 1 (temperatura, duplicados, soft delete, conversión).

---

## 1. Resumen de la implementación

El módulo Leads pasó de no tener ninguna UI de asignación a permitir elegir un **empleado**
del módulo `employees`, con aviso por correo cuando el responsable cambia.

### El hallazgo que condicionó todo el diseño

`leads.assigned_to` **ya existía** y apuntaba a `users.id` (FK `ON DELETE SET NULL`), con
36 de 113 leads ya asignados. Pero el negocio necesita asignar a un **empleado**, y **solo 8
de 17 empleados tienen `user_id`**: no todos los empleados son usuarios. El `user_id` no
sirve como identificador de empleado, así que la columna cambió de significado.

Verificaciones previas hechas sobre la copia local antes de escribir la migración:

| Verificación | Resultado |
|---|---|
| `employees.user_id` es único | Sí, sin duplicados → backfill sin ambigüedad |
| Asignaciones que resuelven a un empleado | **36 de 36** → backfill sin pérdida |
| Asignaciones apuntando a empleado inactivo | **0** |
| Restricciones sobre `assigned_to` | Solo la FK (sin índices) |
| Roles con permiso `ver` sobre `leads` | 7 roles, que son exactamente los que tienen usuarios activos |
| Usuarios activos que pierden acceso | **0** |

### Reglas de envío implementadas

| Situación | ¿Envía correo? |
|---|---|
| Crear lead con empleado asignado | Sí (`Nuevo Lead asignado`) |
| Asignar un lead que no tenía responsable | Sí (`Nuevo Lead asignado`) |
| Reasignar de un empleado a otro | Sí (`Lead reasignado`) |
| Editar sin cambiar el responsable | **No** |
| Repetir la misma petición | **No** (solo un correo) |
| Quitar el responsable sin poner otro | **No** |
| Empleado inexistente | Rechazado con 404, no persiste |
| Empleado inactivo | Rechazado con 422, no persiste |
| Empleado sin correo válido | El lead **se guarda**; se registra el aviso |
| Fallo del servicio de correo | El lead **se guarda**; el error queda registrado |

---

## 2. Archivos creados y modificados

### Creados

| Archivo | Propósito |
|---|---|
| `backend/migrations/138_leads_asignacion_empleado.sql` | Columna, backfill, índice, tabla de notificaciones |
| `backend/src/modules/leads/leads.schema.js` | Esquemas zod: crear, editar, listar, asignables |
| `backend/src/services/leadAsignadoNotifier.js` | Render + envío + registro del resultado |
| `backend/src/templates/lead_asignado.hbs` | Plantilla corporativa HTML |
| `backend/src/modules/leads/__tests__/leads.asignacion.test.js` | 16 pruebas |
| `frontend/src/constants/leads.js` | Catálogo de fuentes (creado en un paso previo) |

### Modificados

| Archivo | Cambio |
|---|---|
| `backend/migrations/runner.js` | Alta de la 138 en `MIGRATION_FILES` (1 línea) |
| `backend/src/modules/leads/leads.repository.js` | `assigned_employee_id`, JOIN a `employees`, `findAsignables`, `findEmpleadoAsignable`, registro de notificaciones |
| `backend/src/modules/leads/leads.controller.js` | Validación del empleado, disparo del correo, `asignables` |
| `backend/src/modules/leads/leads.routes.js` | `verificarPermiso` por endpoint + `validate` + `GET /asignables` |
| `frontend/src/components/Leads/LeadForm.jsx` | Select de empleados con carga, vacío y error |
| `frontend/src/pages/Leads/LeadsPage.jsx` | Columna "Asignado a" y filtro por responsable |

**No se tocó ningún módulo ajeno.** El resto de archivos en `git status` (Informes,
`backupService.js`, `gestionHumana.test.js`) es trabajo tuyo sin confirmar que quedó intacto.

---

## 3. Migración de PostgreSQL

**`138_leads_asignacion_empleado.sql`**, registrada en `MIGRATION_FILES`. Idempotente
(`IF NOT EXISTS` en todo) y transaccional: el runner la envuelve en `BEGIN`/`COMMIT`.

1. `ALTER TABLE leads ADD COLUMN assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL`
2. `UPDATE` de backfill `leads.assigned_to → users → employees.user_id`
3. **Guarda:** un bloque `DO $$` compara el recuento legacy contra el migrado y lanza una
   excepción si falta alguno. Si dispara, se revierte todo y `assigned_to` queda intacta.
4. `CREATE INDEX idx_leads_asignado_empleado`
5. `DROP CONSTRAINT leads_assigned_to_fkey` y `DROP COLUMN assigned_to`
6. `CREATE TABLE lead_asignacion_notificaciones` (patrón outbox) + índice parcial

**Evidencia de la ejecución real** en la copia local `prueba_restore`:

| Métrica | Antes | Después |
|---|---|---|
| Leads con responsable | 36 | **36** |
| Leads sin responsable | 77 | **77** |
| Columna `assigned_to` | presente | retirada |
| Tabla de notificaciones | — | creada |

La guarda no se disparó y `applied_at` quedó registrado en `_migrations`.

---

## 4. Endpoint de empleados activos

**`GET /api/v1/leads/asignables`** (nuevo, dentro del módulo Leads).

- Devuelve **solo `id` y `full_name`**, ordenado alfabéticamente.
- Soporta `?search=` para buscar por nombre.
- Permiso: `leads.ver`.

**No se reutilizó `GET /api/v1/employees?status=Activo`** a propósito: devuelve `e.*`, o sea
que habría **filtrado salario, EPS, ARL, número de documento y dirección al navegador**.

Comprobado contra la base real: 14 empleados activos, columnas exactamente `["id","full_name"]`,
orden alfabético correcto.

---

## 5. Función de correo reutilizada

**`sendMailWithRetry()`** de `backend/src/services/email/emailService.js` — la misma que usan
SOAT, certificados, reset de contraseña y email-marketing. Microsoft Graph, 3 reintentos con
backoff 2s/4s/8s, sin reintentar errores permanentes.

**No se creó ningún cliente SMTP ni proveedor nuevo.**

El patrón de plantilla Handlebars se sigue con el mismo criterio que `soatEmailNotifier.js`
(compilación única al arrancar). `{{ }}` escapa HTML por defecto: comprobado renderizando
`<img src=x onerror=alert(1)>` y `<script>` en los campos dinámicos, que salen escapados.

### Cuándo se envía respecto a la transacción

El correo se pide **después** de que el lead quedó confirmado en la base. Si el servicio de
correo falla, el lead ya existe y no se revierte nada; el fallo queda registrado en
`lead_asignacion_notificaciones` con `status='error'` y el mensaje técnico.

---

## 6. Evidencia de pruebas

### Suite automatizada — 16/16 en verde

```
√ 1.  Crear Lead sin asignación: sin correo y sin registro
√ 2.  Crear Lead con empleado activo: envía el correo
√ 3.  Asignar un Lead que no tenía responsable: envía el correo
√ 4.  Reasignar a otro empleado: asunto "Lead reasignado"
√ 5.  Editar sin cambiar el responsable: NO envía correo
√ 6.  Empleado INACTIVO: 422 y no persiste
√ 7.  Empleado INEXISTENTE: 404 y no persiste
√ 8.  Empleado sin correo válido: el Lead se guarda y se registra el aviso
√ 9.  Fallo del servicio de correo: el Lead persiste, error registrado
√ 10. Petición repetida: solo un correo
√ 11. Lead asignado a empleado hoy inactivo: el nombre sigue mostrándose
√ 12. Sin permisos: 403 y no modifica
√     El endpoint de asignables expone SOLO id y nombre
√     Rechaza un assigned_employee_id que no sea UUID
√     El filtro "Sin asignar" llega al repositorio
√     Crear un lead exige nombre
```

### Prueba contra la base real (sin mocks)

| Verificación | Resultado |
|---|---|
| Empleados activos devueltos | 14 |
| Columnas expuestas | `id`, `full_name` únicamente |
| Orden alfabético | Correcto |
| Columnas del responsable en el listado | `assigned_employee_id`, `assigned_employee_name` |
| Filtro "Sin asignar" | 77 leads, todos con `NULL` |
| Escape de HTML en la plantilla | Correcto |
| Tabla de notificaciones | Creada, 0 registros |

### Suite completa del backend

`audit.middleware`, `servicios` y `remisionSustitucion` siguen en verde → **sin regresiones**.

---

## 7. Riesgos y configuraciones pendientes

### Pendientes que necesitan tu decisión

1. **`npm test` del backend está roto.** El script llama a
   `node_modules/.bin/jest` dentro de `backend/`, pero Jest está hoisted a la raíz del
   workspace, así que `npm test` termina con `MODULE_NOT_FOUND`. Lo ejecuté por la ruta real.
   Lo dejo sin tocar porque es de infraestructura y afecta a todos los módulos.

2. **La URL del correo apunta a `/leads`, no a un detalle.** Pediste "URL directa al Lead",
   pero **no existe ruta `/leads/:id` en el frontend** (solo `/leads`, con el detalle en un
   modal). No inventé una ruta que no funciona. Para el enlace directo haría falta crear esa
   ruta; dime si la quieres.

3. **No hay cola de trabajos genérica.** El outbox de SOAT existe pero es de ese dominio
   (`equipo_id NOT NULL`) y su worker es un cron específico, así que no admite filas de
   leads. Seguí tu cláusula de fallback: envío tras el commit, errores manejados sin revertir.
   Si quieres entrega garantizada, la tabla ya está preparada y solo faltaría el worker.

### Riesgos conocidos

4. **`DROP COLUMN assigned_to` es irreversible.** Lo autorizaste y la guarda del backfill
   protege la ejecución, pero conviene un respaldo previo (`pg_dump -t leads`) antes de
   desplegar a producción.

5. **La columna ya está aplicada en la copia local.** En producción se aplicará sola en el
   próximo arranque (`npm start` ejecuta `npm run migrate`).

6. **5 minutos de demora en cambios de permiso.** `obtenerPermisosUsuario` cachea 300 s:
   un permiso recién otorgado puede tardar hasta 5 minutos en reflejarse.

7. **`ON DELETE CASCADE` en `lead_asignacion_notificaciones.lead_id`.** Si borras un lead,
   su historial de notificaciones se borra con él. Se eligió así para no romper el endpoint
   `DELETE /api/v1/leads/:id`. Si prefieres conservar el historial aunque se borre el lead,
   habría que cambiarlo a `SET NULL`.

---

## 8. Cómo verificarlo a mano

```bash
# Empleados activos disponibles
GET /api/v1/leads/asignables

# Crear un lead asignado (debe llegar el correo)
POST /api/v1/leads  { "first_name": "Carlos", "assigned_employee_id": "<uuid>" }

# Reasignar (asunto "Lead reasignado")
PATCH /api/v1/leads/<id>  { "assigned_employee_id": "<otro-uuid>" }

# Editar sin tocar el responsable (no debe llegar correo)
PATCH /api/v1/leads/<id>  { "phone": "3000000000" }

# Historial de envíos
SELECT status, attempts, last_error, sent_at FROM lead_asignacion_notificaciones;
```
