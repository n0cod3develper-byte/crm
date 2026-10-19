# Fase 0 — Reconocimiento del módulo Leads (SOLO LECTURA)

**Proyecto:** CRM interno CARGAR S.A.S.
**Módulo:** Leads
**Fecha:** 2026-10-19
**Naturaleza:** Reconocimiento. No se modificó código ni datos. Las consultas a base de datos fueron exclusivamente `SELECT`/`information_schema`, sin exponer datos personales.

**Entorno inspeccionado:** base de datos local de trabajo `prueba_restore` (host `::1`, puerto 5432), que es una **copia restaurada** usada para desarrollo. Los conteos de datos reflejan esa copia; producción puede tener volúmenes distintos.

---

## 1. Mapa de archivos del módulo

### Backend

| Rol | Archivo | Notas |
|---|---|---|
| Rutas | `backend/src/modules/leads/leads.routes.js` | 6 endpoints; solo `authenticate`, **sin RBAC de acción** |
| Controlador | `backend/src/modules/leads/leads.controller.js` | `list, get, create, update, convert, remove` |
| Repositorio | `backend/src/modules/leads/leads.repository.js` | SQL parametrizado; `convertToContact` |
| Montaje | `backend/src/app.js` (línea 34 import, 191 `app.use('/api/v1/leads', leadsRoutes)`) | — |
| Auditoría | `backend/src/middleware/audit.middleware.js` (línea 11 mapea `/api/v1/leads` → `leads`) | Registra POST/PUT/PATCH/DELETE exitosos en `audit_logs` |

No existen `leads.service.js`, `leads.model.js` ni carpeta `__tests__` para este módulo. El módulo es un CRUD "repositorio → controlador" sin capa de servicio ni validación (no usa `middleware/validate.js` ni Zod).

### Frontend

| Rol | Archivo | Notas |
|---|---|---|
| Página | `frontend/src/pages/Leads/LeadsPage.jsx` | Lista + filtros por estado + acciones (editar, convertir, eliminar) |
| Formulario | `frontend/src/components/Leads/LeadForm.jsx` | Modal de creación/edición (React Hook Form + Zod local) |
| Ruta | `frontend/src/App.jsx` (línea 239) | `/leads` protegida con `ProtectedRoute modulo="leads" accion="ver"` |
| Menú | `frontend/src/components/layout/Sidebar.jsx` (línea 30) | Ítem "Leads" |
| Modal | `frontend/src/components/common/Modal.jsx` | Componente reutilizable (no cierra con Escape/backdrop) |
| Cliente API | `frontend/src/lib/api` | Axios con cookies |

No hay hook dedicado ni archivo de API por módulo: las llamadas se hacen inline con `api.get/post/patch/delete('/leads...')`.

### Endpoints actuales

| Método | Ruta | Controlador | Permiso backend |
|---|---|---|---|
| GET | `/api/v1/leads` | `list` | Solo `authenticate` |
| POST | `/api/v1/leads` | `create` | Solo `authenticate` |
| GET | `/api/v1/leads/:id` | `get` | Solo `authenticate` |
| PATCH | `/api/v1/leads/:id` | `update` | Solo `authenticate` |
| PATCH | `/api/v1/leads/:id/convert` | `convert` | Solo `authenticate` |
| DELETE | `/api/v1/leads/:id` | `remove` | Solo `authenticate` |

Query params soportados por `list`: `status`, `assignedTo`, `source`, `campaignId`, `search`, `limit`, `cursor` (los dos últimos con paginación por cursor). El frontend hoy solo envía `status`, `search` y `limit`.

---

## 2. Esquema real de la tabla `leads`

Definida en `backend/migrations/001_initial_schema.sql` (líneas 218-236). **Ninguna migración posterior la altera** (se verificó: `leads` solo aparece en `001` y su registro de módulo en `054`). El esquema real en la copia coincide con la migración.

| Columna | Tipo | Nulo | Default | Uso en código |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | ✔ |
| `first_name` | varchar(100) | NO | — | ✔ (obligatorio) |
| `last_name` | varchar(100) | SÍ | — | ✔ |
| `email` | varchar(255) | SÍ | — | ✔ |
| `phone` | varchar(30) | SÍ | — | ✔ |
| `company_name` | varchar(255) | SÍ | — | ✔ (texto libre, sin FK a `companies`) |
| `source` | varchar(100) | SÍ | — | ✔ (texto libre) |
| `campaign_id` | uuid | SÍ | — | ✔ (FK → `campaigns`) |
| `status` | varchar(30) | SÍ | `'new'` | ✔ |
| `score` | integer | SÍ | `0` | ✔ (scoring manual 0-100) |
| `assigned_to` | uuid | SÍ | — | ✔ (FK → `users`) — **ya existe**, sin UI |
| `converted_contact_id` | uuid | SÍ | — | ✔ (FK → `contacts`) |
| `converted_at` | timestamptz | SÍ | — | ✔ |
| `notes` | text | SÍ | — | ✔ |
| `created_at` | timestamptz | SÍ | `now()` | ✔ |
| `updated_at` | timestamptz | SÍ | `now()` | ✔ |

**Valores permitidos de `status`** (CHECK `leads_status_check`): `new`, `contacted`, `qualified`, `converted`, `dead`. No existe un estado literal "perdido": lo equivalente hoy es `dead` ("Descartado" en la UI).

**Constraints:**
- PK `leads_pkey` (id).
- FK `leads_assigned_to_fkey` → `users(id)` `ON DELETE SET NULL`.
- FK `leads_campaign_id_fkey` → `campaigns(id)` `ON DELETE SET NULL`.
- FK `leads_converted_contact_id_fkey` → `contacts(id)`.
- CHECK de `status` (arriba).

**Índices:** `leads_pkey` (id) e `idx_leads_status` (`status, created_at DESC`). No hay índice sobre `email`, `phone`, `company_name`, `assigned_to` ni `created_at` solo.

**Comprobación código ↔ migraciones:** todas las columnas que el código lee/escribe existen en migraciones. **No se detectó ninguna columna usada por el código que ninguna migración cree.** El código ya usa `assigned_to`, pero la UI no lo expone.

---

## 3. Datos existentes (agregados, sin datos personales)

Copia local `prueba_restore`:

- **Total de leads: 1.**
- Por estado: `qualified` = 1.
- Por fuente: `Facebook` = 1.
- Scoring: mín 97, máx 97, promedio 97 (rango 71-100).
- Leads con `assigned_to`: 0 de 1.
- Empresas existentes: **4.924** · Contactos existentes: **215** (contexto para detección de duplicados).

> Nota: el volumen real de leads en producción es probablemente mayor. La copia local sirve para validar estructura y compatibilidad, no para calibrar UX de volumen.

---

## 4. Permisos RBAC que protegen el módulo hoy

**Matriz en base de datos** (tabla `roles_permisos` para el módulo `leads`, id `e0207e79-...`):

| Rol | ver | crear | editar | eliminar |
|---|---|---|---|---|
| admin | ✔ | ✔ | ✔ | ✔ |
| aprobador_1 | ✔ | ✔ | ✔ | ✔ |
| contabilidad | ✔ | ✔ | ✔ | ✘ |
| facturador | ✔ | ✔ | ✔ | ✔ |
| gerencia | ✔ | ✘ | ✘ | ✘ |
| gestion_humana | ✔ | ✘ | ✘ | ✘ |
| mantenimiento | ✔ | ✔ | ✔ | ✔ |

**Cómo se verifica hoy:**
- **Frontend:** `ProtectedRoute modulo="leads" accion="ver"` (App.jsx) bloquea el acceso a la página según `user.permisos.leads.ver`.
- **Backend:** los 6 endpoints usan únicamente `authenticate` (`requireAuth`). **El backend NO valida `verificarPermiso('leads', acción)`**, por lo que cualquier usuario autenticado y activo puede invocar cualquier endpoint de leads aunque su rol tenga `puede_crear/editar/eliminar = false` (p. ej. `gerencia` o `gestion_humana`).

---

## 5. Dependencias con otros módulos

Se buscó en todo `backend/src` y `frontend/src` referencias al módulo Leads:

- **Ningún otro módulo lee ni escribe `leads`.** Dashboard, Tareas, Email Marketing, Búsqueda Global, Informes y Reportes **no** consultan la tabla `leads` ni sus endpoints.
- La migración `054` da permisos de admin al módulo; `audit.middleware.js` mapea `/api/v1/leads` → `leads` para la bitácora.
- Dependencias de datos **salientes** (leads → otros): FK a `campaigns`; y al convertir, `convertToContact` crea/lee `companies` e inserta en `contacts`.

**Conclusión:** los cambios A–H quedan contenidos en el módulo Leads salvo el ítem H ("Empresa con búsqueda por NIT/nombre" y consentimiento), que **lee** el módulo Empresas y reutiliza lo de Email Marketing sin modificarlo. Impacto estimado en otros módulos: **nulo**, excepto si en Fase 1 se decide exponer un listado de usuarios para el campo "Asignado a" (ver riesgos).

---

## 6. Estado de migraciones

Verificado contra el disco, contra el arreglo `MIGRATION_FILES` de `backend/migrations/runner.js` y contra la tabla `_migrations`:

- Archivos `.sql` en disco: **139**. Entradas en `MIGRATION_FILES`: **139**. Filas en `_migrations`: **140**.
- **No hay archivos `.sql` huérfanos** (todo archivo en disco está en el arreglo) **ni entradas del arreglo sin archivo**.
- **Colisiones de numeración preexistentes:** `076` (`076_add_estibador_tipo_equipo.sql` y `076_supplier_quotes_reestructura.sql`) y `129` (`129_busqueda_global_indexes.sql` y `129_codigo_interno_por_familia.sql`). El runner funciona porque usa el **nombre completo** como clave, no el número.
- **Fila huérfana en `_migrations`:** `068_servicio_fijo.sql` figura aplicada pero **no existe en disco ni en `MIGRATION_FILES`**. Es un residuo histórico; no rompe nada, pero conviene documentarlo.
- **Último número usado: 137.** Próximo número libre: **138** (evitando 076 y 129).
- Todas las entradas del arreglo están aplicadas (`en_array_sin_aplicar: []`).

**Higiene de repositorio (fuera del alcance de Leads, solo se informa):** el árbol de trabajo **no está limpio** y la rama activa **no es `main`** (`audit/loote-1-seguridad`). Hay migraciones ya aplicadas con cambios sin confirmar (`017`, `020`, `048`, `049`, `067`, `088`, `126`, `130`) y archivos nuevos sin seguimiento. Esto implica que la copia local podría tener un esquema distinto al que generaría un entorno limpio. Es relevante para el plan de Fase 2 (rama aparte y punto de partida).

---

## 7. Problemas detectados (no se corrigió nada)

Severidad: 🔴 alta · 🟠 media · 🟡 baja

- 🔴 **P1 — RBAC no aplicado en backend.** Los endpoints de leads no invocan `verificarPermiso`. Un usuario con permiso de solo lectura en `leads` (o incluso roles sin `puede_crear`) puede crear, editar, convertir y eliminar leads por API. Solo el frontend restringe.
- 🔴 **P2 — La conversión de lead rompe al crear empresa nueva (bug confirmado).** `convertToContact` ejecuta `INSERT INTO companies (name) VALUES ($1)`, pero `companies.nit` y `companies.address` son **NOT NULL sin default** (migración 061). Cualquier lead con `company_name` de una empresa inexistente fallará al convertir. El camino "empresa ya existe" sí funciona.
- 🟠 **P3 — Sin validación de entrada en backend.** `create` y `update` pasan `req.body` al repositorio sin Zod ni `validate()`. No se valida formato de email, longitud de campos, ni tipo de `score`. La única barrera son los CHECK/NOT NULL de la BD (que devuelven errores poco amigables).
- 🟠 **P4 — Errores de datos devueltos como 500.** Un `status` fuera del CHECK o un `first_name` vacío provoca un error de Postgres que llega al cliente como error interno en lugar de `400/422` con mensaje claro.
- 🟠 **P5 — `convertToContact` no es transaccional.** Crea/busca empresa y luego inserta el contacto en pasos separados: si falla el segundo (p. ej. por P2 o por otra causa), puede quedar una empresa creada sin contacto.
- 🟠 **P6 — DELETE es físico (hard delete).** `DELETE FROM leads` no usa soft delete; se pierde el registro y la trazabilidad (la auditoría guarda el body, pero no el histórico del lead). Otras entidades del CRM usan `deleted_at`.
- 🟡 **P7 — Sin detección de duplicados.** No hay validación ni aviso al crear/editar (ítem D a implementar).
- 🟡 **P8 — `source` es texto libre.** No hay catálogo ni normalización; se ven valores dispares (ítem A a implementar).
- 🟡 **P9 — Scoring manual.** `score` 0-100 lo ingresa el usuario; no hay cálculo (ítem F a implementar). Se debe conservar el histórico (hoy hay un lead con score 97).
- 🟡 **P10 — Renderizado de datos sin sanitizar.** `notes`, `first_name`, etc. se guardan crudos. Hoy la lista no los renderiza con `dangerouslySetInnerHTML`, así que el riesgo XSS es latente (bajo), pero conviene sanitizar en backend.
- 🟡 **P11 — Modelo de "Asignado a" incompleto.** Existe la columna y el filtro en backend (`assignedTo`), pero no hay campo en la UI, ni filtro en la lista, ni endpoint de listado de usuarios accesible a no administradores (`/api/v1/admin/usuarios` exige `soloAdmin`).
- 🟡 **P12 — Búsqueda limitada.** `search` no incluye `phone` ni `assigned_to`; el índice de la lista no cubre `ORDER BY created_at DESC` sin filtro de estado (posible *sort* sobre secuencia con volumen alto).
- 🟡 **P13 — `updated_at` no se autogestiona.** No hay trigger; `update` lo setea a mano, pero `convert` no lo actualiza.

---

## 8. Resumen de impacto de los ítems A–H sobre lo existente

| Ítem | Estado actual | Naturaleza del cambio | ¿Toca otros módulos? |
|---|---|---|---|
| A — Fuente como lista | `source` texto libre | Catálogo + normalización de datos históricos | No |
| B — Responsable | columna y filtro backend ya existen; sin UI | UI + posible endpoint de usuarios | Sí, si el listado de usuarios se expone (hoy es solo admin) |
| C — Ciudad / Cargo | no existen | Columnas nuevas | No |
| D — Duplicados | no existe | Endpoint + UI + índices | No (lee `contacts`/`companies`) |
| E — Motivo de pérdida | no existe | Columna + validación backend + modal | No |
| F — Temperatura | `score` manual | Cálculo backend + conservar histórico | No |
| G — Modal | existe | Rediseño UI | No |
| H — Empresa + Habeas Data | parcial/no | Lee Empresas; reutiliza patrón de Email Marketing | Sí (solo lectura) |

---

## 9. Riesgos

1. **Riesgo de seguridad (P1):** el módulo está protegido solo en el frontend; cualquiera con sesión puede mutar leads. Debe abordarse en Fase 2 junto con los cambios (es parte del alcance).
2. **Riesgo funcional (P2/P5):** la conversión a contacto con empresa nueva está rota hoy. Si el item H o las pruebas de Fase 3 dependen de convertir, hay que decidir si lo corregimos (implica tocar `leads.repository.js`, que está en alcance) o lo dejamos documentado.
3. **Riesgo de datos:** cualquier normalización de `source` (item A) o mapeo de scoring→temperatura (F) debe preservar el texto/valor original (item A lo pide explícitamente; conviene replicar para el score).
4. **Riesgo de entorno:** árbol sucio y rama distinta de `main`, con migraciones modificadas sin confirmar. Antes de crear `feature/leads-fase1` conviene acordar el punto de partida.
5. **Riesgo de alcance:** el catálogo de fuentes y el mapeo del scoring histórico son decisiones de negocio; sin confirmación pueden quedar mal.

---

## 10. Qué necesito de ti (decisiones / confirmaciones)

1. **Confirmación de datos reales:** la copia local tiene **1 solo lead**. ¿Tienes una copia anonimizada más representativa de producción para validar el mapeo de `source` y de scoring histórico, o trabajamos con esta?
2. **Item H:** ¿se incluye en esta fase (búsqueda de empresa por NIT/nombre + consentimiento Habeas Data) o queda para después? Lo necesito para la Fase 1.
3. **Corrección del bug de conversión (P2):** ¿autorizas corregir `leads.repository.js` en Fase 2 para que la conversión cree la empresa correctamente (nit/address), o lo dejamos fuera de alcance?
4. **Punto de partida de rama:** ¿creo `feature/leads-fase1` desde el estado actual de `audit/loote-1-seguridad` con cambios sin confirmar, o esperamos a que se limpie/mezcle?
5. **Alcance de "Perdido":** ¿"Perdido" es el estado `dead` existente (no se agrega estado nuevo), o quieres un estado distinto? Afecta migración y CHECK.
6. **Asignación a usuario:** ¿el campo "Asignado a" debe permitir elegir cualquier usuario activo (requiere endpoint de listado para no administradores) o solo el propio usuario/usuarios del equipo comercial?

---

## Cierre de fase — formato de respuesta

**1. Qué hice:** reconocimiento completo en solo lectura del módulo Leads (archivos, esquema real en la copia `prueba_restore`, datos agregados, RBAC, dependencias y estado de migraciones) y verificación cruzada de migraciones contra disco/arreglo/`_migrations`.

**2. Hallazgos o decisiones:** el módulo es autocontenido; la tabla `leads` ya tiene `source`, `assigned_to` y `score`; **el RBAC no se aplica en backend**; **la conversión de lead con empresa nueva está rota (NOT NULL nit/address)**; hay una colisión histórica de numeración (076, 129) y una fila huérfana en `_migrations` (`068_servicio_fijo.sql`). No se detectaron columnas usadas por el código sin migración.

**3. Riesgos:** exposición de endpoints sin RBAC, conversión rota, pérdida del texto/valor original en la normalización, árbol de trabajo sucio y decisiones de negocio (fuentes, scoring, item H) aún abiertas.

**4. Qué necesito de ti:** respuestas a los 6 puntos de la sección 10 (especialmente item H, corrección de P2, rama de partida y alcance de "Perdido").

Entregable: `docs/leads/fase0-reconocimiento.md`.

**Esperando APROBADO para la siguiente fase.**
