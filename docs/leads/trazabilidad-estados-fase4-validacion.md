# Fase 4 — Validación formal: trazabilidad de estados de Leads

**Rama:** `feature/leads-trazabilidad-estados`
**Base:** `188a879` (`fix/migraciones-conflicto-067`)
**Fecha:** 2026-10-20
**Entorno:** local, PostgreSQL `prueba_restore` (`::1:5432`)
**Estado:** validación ejecutada. **Sin push y sin despliegue.**

---

## 1. Resumen ejecutivo

| Resultado | Valor |
|---|---|
| Pruebas del módulo Leads | **111/111** (3 suites) |
| Suite completa | **161 pasaron / 185**, 24 fallos preexistentes y ajenos |
| Requisitos de la Fase 4 | **13 cumplen plenamente**; la conversión con empresa queda **bloqueada por B1**; el chequeo de huérfanas es informativo |
| Migración 142 | aplicada, idempotente, objetos verificados |
| Cobertura de `CREACION` | **115/115 leads**, 0 duplicados |
| Migraciones huérfanas | **1 preexistente:** `068_servicio_fijo.sql` |
| Regresiones introducidas | **ninguna** |

La trazabilidad de estados cumple lo pedido. El único bloqueo detectado **no lo introduce este cambio**: la conversión de un lead que tiene `company_name` ya fallaba antes de la Fase 3 porque `convertToContact` inserta solo `name` en `companies`, mientras que `nit` y `address` son `NOT NULL` desde la migración 061. Afecta a **101/101** leads con empresa en la base local. Requiere decisión antes de desplegar (ver §5, B1).

---

## 2. Método y comandos ejecutados

Desde `backend/`:

```powershell
npm test -- src/modules/leads        # 111/111
npm test                              # 161/185; 24 fallos preexistentes
npm run migrate                       # base al día
```

Verificaciones adicionales:

- Consulta directa a `lead_history`, `_migrations`, `pg_indexes` y `pg_trigger`.
- Comparación `MIGRATION_FILES` ↔ archivos ↔ filas de `_migrations`.
- Formateo de una fecha UTC con el mismo `Intl.DateTimeFormat` del frontend.
- Búsqueda de puntos de escritura de `leads.status` y de la superficie del historial.

---

## 3. Matriz de validación

| # | Requisito | Evidencia | Resultado |
|---|---|---|---|
| 1 | Caso de creación | Tests `1` y `1b`: `CREACION` con usuario, fecha, `valorAnterior=null` y estado inicial (`new` y `qualified`) | ✅ |
| 2 | Cambio con nota | `N1`: guarda nota, usuario y fecha; `PATCH` propaga la nota | ✅ |
| 3 | Cambio sin nota rechazado | `N2` (422 y sin rastro), `N3` (nota < 5), unitarias de `validarNotaCambioEstado`; API de conversión 422 | ✅ |
| 4 | Mismo estado sin registro | `N4`: sin nota y sin evento; API `PATCH` mismo estado no exige nota | ✅ |
| 5 | Atomicidad | `11` (fallo de auditoría revierte el `UPDATE`) y `N11` (fallo de auditoría revierte contacto + lead en la conversión) | ✅ (contacto + lead) |
| 6 | Concurrencia | `10` (dos `PATCH` simultáneos no pierden campos) y `N5` (dos cambios de estado quedan encadenados) | ✅ |
| 7 | Todos los puntos de entrada | `POST /leads` → `createConHistorial`; `PATCH /leads/:id` → `updateConHistorial`; `PATCH /leads/:id/convert` → `convertToContact`; sin otros escritores de `status` | ⚠️ traza OK; empresa bloqueada por B1 |
| 8 | Edición/borrado bloqueados | `N9`: `UPDATE` auditado y `DELETE` fallan (23001); API sin endpoints de escritura/borrado; UI solo hace `GET /history`; `A3` bloquea editar archivados | ✅ |
| 9 | 403 | Tests API: historial, restauración, asignación, gestiones, conversión y cambio de estado sin permiso | ✅ |
| 10 | SQLi/XSS | `N12`: la nota se guarda literal y `lead_history` sigue existiendo; unitaria acepta el literal; frontend sin `dangerouslySetInnerHTML` | ✅ |
| 11 | Backfill idempotente | `N10` (segundo INSERT no duplica) + verificación en base: 115/115, 0 duplicados, 114 marcados `origen=migracion` | ✅ |
| 12 | Orden y zona America/Bogota | Test `8` (descendente); SQL `ORDER BY fecha DESC, id_orden DESC`; `Intl` convierte `13:31:30Z` → `20/10/2026, 8:31 a. m.` | ✅ |
| 13 | Duración | `N7` (estado actual y anterior), `N8` (modificaciones sin duración); SQL `LEAD()` sobre `CREACION`/`CAMBIO_ESTADO`; backfill `duracionConfiable=false` | ✅ |
| 14 | Regresión | 111/111 Leads; suite completa 161/185 con los mismos 24 fallos preexistentes; build del frontend y ESLint de los archivos tocados verificados en Fase 3 | ✅ |
| 15 | Huérfanas | 144 declaradas, 144 archivos, 145 aplicadas; única huérfana `068_servicio_fijo.sql` (preexistente) | ⚠️ informativa |

---

## 4. Evidencia detallada

### 4.1 Creación y cambios de estado

- `1`: `CREACION` con `valorNuevo='new'`, usuario `Tester Historial`.
- `1b`: creación con `status='qualified'` registra `valorAnterior=null`, `valorNuevo='qualified'`.
- `N1`: `CAMBIO_ESTADO` con nota, usuario y fecha; la nota viaja por el `PATCH`.
- `N2`/`N3`: sin nota o con menos de 5 caracteres → **422**, sin modificar el lead ni dejar eventos.
- `N4`: reenviar el mismo estado → sin nota, sin evento.
- `5b`: `dead` genera `CAMBIO_ESTADO` + `CIERRE`; `5c`: `dead → converted` conserva **un solo** `CIERRE` (ambos son terminales) y sí registra el `CAMBIO_ESTADO` con nota.

### 4.2 Atomicidad y concurrencia

- `11`: un trigger que falla al insertar en `lead_history` revierte también el `UPDATE` del lead.
- `N11`: con un trigger que falla solo en `CAMBIO_ESTADO`, la conversión revierte el contacto creado, deja el lead en `qualified`, sin `converted_contact_id` y sin evento.
- `10` y `N5`: dos operaciones simultáneas se serializan con `SELECT ... FOR UPDATE OF l`; no se pierden campos ni se rompe la cadena de estados.

Limitación declarada: `N11` no cubre la creación de empresa porque ese camino está bloqueado por B1. La atomicidad de contacto + lead sí queda demostrada.

### 4.3 Inmutabilidad y superficie de escritura

- `N9`: `UPDATE` de `description`/`new_value`/`nota` y `DELETE` lanzan `restrict_violation` (23001); solo `metadata` es actualizable.
- `A4`/`R8`: el `DELETE` físico del lead con historial queda bloqueado por `RESTRICT`.
- Rutas de Leads: 12 en total; el historial solo expone `GET /:id/history` y `GET /:id/summary`. No hay `POST`/`PATCH`/`PUT`/`DELETE` de historial.
- Frontend: `LeadHistoryTimeline.jsx` solo hace `api.get('/leads/:id/history')`; no usa `dangerouslySetInnerHTML`; React escapa la nota.

### 4.4 Backfill y migración

Verificación en `prueba_restore`:

```text
declaradas=144  archivos=144  aplicadas=145
huérfanas=[068_servicio_fijo.sql]
declaradas sin aplicar=[]   archivos no declarados=[]
142 aplicada (id 148)
lead_history.nota = text
uq_lead_history_creacion = presente
trg_lead_history_proteger = presente
leads=115  con_creacion=115  sin_creacion=0  duplicados=0
eventos con metadata.origen='migracion' = 114
```

Re-ejecutar el SQL de la 142 es idempotente (`ON CONFLICT DO NOTHING` + índice único parcial).

### 4.5 Orden, zona horaria y duración

- Orden: `ORDER BY fecha DESC, id_orden DESC`; test `8` recorre la línea de tiempo y verifica que nunca “sube” en el tiempo.
- Zona: el backend devuelve ISO; el frontend formatea con `timeZone: 'America/Bogota'`. Prueba con `2026-10-20T13:31:30.437Z` → `20/10/2026, 8:31 a. m.` (UTC-5).
- Duración: `LEAD(created_at)` sobre las entradas `CREACION`/`CAMBIO_ESTADO`; el último estado usa `now()`; las modificaciones intermedias no cortan la duración; el backfill se marca `duracionConfiable=false`.

---

## 5. Hallazgos

### B1 — Bloqueante preexistente: conversión con empresa

**Qué pasa:** `convertToContact` hace:

```sql
INSERT INTO companies (name) VALUES ($1) RETURNING id
```

Pero la migración `061_companies_required_fields.sql` dejó `companies.nit` y `companies.address` como `NOT NULL`. Cualquier lead con `company_name` que no coincida con una empresa existente falla con `23502` (“el valor nulo en la columna «nit»…”).

**Impacto medido en la base local:**

```text
leads con company_name = 101
empresa ya existente   = 0
empresa por crear      = 101
```

**Alcance:** es un defecto **anterior** a este trabajo (el `INSERT` viene del commit inicial `fc875d7`; la migración 061 es posterior). No lo introduce la trazabilidad, pero **bloquea la conversión** y contradice el texto del modal: «se creará un contacto y se vinculará la empresa».

**Opciones (requieren decisión):**

- **A. Placeholder consistente con 061 (recomendada si se quiere desbloquear ya):** insertar `nit = 'PENDIENTE-' || gen_random_uuid()` y `address = 'Por completar'`, marcando la empresa para completar. Es el mismo criterio que usó la 061 (`TEMP_…`, `Sin dirección`). Ventaja: la conversión funciona; desventaja: crea datos por completar.
- **B. No crear la empresa:** si no hay coincidencia, crear el contacto con `company_id = NULL` y avisar en la UI. Ventaja: no inventa datos; desventaja: se pierde el vínculo y hay que ajustar el modal.
- **C. Pedir NIT y dirección en el modal** cuando la empresa no exista. Mejor calidad de datos; más trabajo y cambio de contrato del endpoint.

No se modificó nada de `companies` ni de la conversión: la instrucción es informar antes de tocar módulos ajenos y esperar autorización.

### H1 — Migración huérfana `068_servicio_fijo.sql`

Aplicada en `_migrations` pero sin archivo en `backend/migrations/` ni historial en Git. Es preexistente y no se tocó. Queda pendiente decidir si se documenta, se elimina del registro o se reconstruye el archivo.

### H2 — Fallos preexistentes de la suite completa

- `horasExtras.service.test.js`: 24 fallos (ajenos).
- `emailMarketing.service.test.js`: no carga `.env` (ajeno).
- `informes/gestionHumana.test.js`: archivo ajeno sin commitear.

No hay regresiones del módulo Leads: las 3 suites de Leads pasan completas.

### H3 — Operación

No hay `pg_dump` de producción ni ventana de staging. El `start` ejecuta `npm run migrate && node src/app.js` y las 3 réplicas compiten al arrancar; la 142 está diseñada para ser idempotente y tolerar esa concurrencia, pero debe probarse en staging con las 3 réplicas.

---

## 6. Checklist de despliegue (pendiente de autorización)

1. Respaldo de producción (`pg_dump`) y verificación de restauración.
2. Desplegar la rama en staging con 3 réplicas; confirmar que la 142 se aplica una sola vez y que el backfill no duplica.
3. Prueba funcional en staging: crear, cambiar estado con nota, sin nota (422), mismo estado, convertir con y sin empresa, 403, historial de un lead archivado.
4. Verificar zona horaria y duración en el navegador.
5. Desplegar a producción en ventana acordada.
6. Verificar las 3 réplicas: `SELECT count(*) FROM _migrations WHERE filename LIKE '142%'` = 1; `CREACION` sin duplicados; trigger e índice presentes.
7. Monitorear errores 500 de `/leads/:id/convert` (B1) antes de anunciar la funcionalidad.

---

## 7. Decisiones solicitadas

1. **B1:** ¿A, B o C? Sin decisión, la conversión de leads con empresa seguirá fallando (101/101 en local).
2. **H1:** ¿Qué hacemos con `068_servicio_fijo.sql`?
3. **Despliegue:** autorización de push y de la ventana de staging/producción.
4. **Respaldo:** facilitar `pg_dump` de producción y acceso a staging.

---

## 8. Conclusión

La trazabilidad de estados (nota obligatoria, inmutabilidad, backfill, duración, orden, zona horaria, RBAC y puntos de entrada) está **validada**. El despliegue no debe darse por bueno hasta resolver B1, porque la conversión con empresa es una acción visible para el usuario y hoy devuelve error.
