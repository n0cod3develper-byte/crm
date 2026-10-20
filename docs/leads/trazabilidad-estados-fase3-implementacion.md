# Fase 3 — Implementación: trazabilidad de estados con nota

**Rama:** `feature/leads-trazabilidad-estados` (creada desde `fix/migraciones-conflicto-067`)
**Fecha:** 2026-10-20
**Estado:** implementado y validado en local. **Sin push y sin despliegue.**

---

## 1. Qué se implementó

Cada cambio de estado de un lead queda registrado con:

| Dato | Dónde |
|---|---|
| Fecha y hora | `lead_history.created_at` (se muestra en `America/Bogota`) |
| Estado anterior y nuevo | `old_value` / `new_value` |
| Nota del usuario | `lead_history.nota` (nueva columna) |
| Usuario | `performed_by_user_id` / `performed_by_name` |
| Duración en el estado | Calculada en `findEvents` con `LEAD()` |

Además:

- La nota es **obligatoria** cuando el estado cambia de verdad (mínimo 5, máximo 1000).
- La conversión a contacto también exige nota.
- El historial es **inmutable** por base de datos: `UPDATE` de campos auditados y `DELETE` fallan.
- El backfill deja un `CREACION` por lead existente, sin duplicar y sin inventar historia.
- El formulario de edición **ya no permite** cambiar el estado: se usa la acción dedicada.
- La línea de tiempo muestra la nota y la duración por estado.

---

## 2. Migración `142_lead_historial_nota_inmutabilidad.sql`

Archivo nuevo: `backend/migrations/142_lead_historial_nota_inmutabilidad.sql`
Registrada en `MIGRATION_FILES` de `backend/migrations/runner.js`.

### 2.1 Contenido

1. `ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS nota TEXT`.
2. Índice único parcial `uq_lead_history_creacion ON lead_history (lead_id) WHERE event_type = 'CREACION'`.
3. Backfill: un `CREACION` por lead sin evento de creación.
   - `created_at = leads.created_at`.
   - `metadata.origen = 'migracion'` y `metadata.estado_actual_al_migrar = true`.
   - `ON CONFLICT DO NOTHING` → idempotente con 1 o 3 réplicas arrancando a la vez.
4. Función `lead_history_proteger()` + trigger `trg_lead_history_proteger`
   (`BEFORE UPDATE OR DELETE FOR EACH ROW`).
   - `DELETE`: bloqueado salvo `app.permite_borrar_historial = 'on'` (solo pruebas/seed).
   - `UPDATE`: solo se permite cambiar `metadata`; cualquier campo auditado lanza
     `restrict_violation` (código `23001`).

### 2.2 Verificación local ejecutada

- `npm run migrate`: aplicada (registro 148 en `_migrations`).
- Re-ejecución del SQL completo: `antes=116 / después=116` → **idempotente**.
- `UPDATE` de `description`: bloqueado (`23001`).
- `DELETE`: bloqueado (`23001`).
- `UPDATE` de `metadata`: permitido.
- Backfill: 114 leads migrados + 1 `CREACION` real ya existente = 115 leads cubiertos.

### 2.3 Rollback (documentado en el propio archivo)

```sql
DROP TRIGGER IF EXISTS trg_lead_history_proteger ON lead_history;
DROP FUNCTION IF EXISTS lead_history_proteger();
DROP INDEX IF EXISTS uq_lead_history_creacion;
SET app.permite_borrar_historial = 'on';
DELETE FROM lead_history WHERE metadata->>'origen' = 'migracion';
RESET app.permite_borrar_historial;
ALTER TABLE lead_history DROP COLUMN IF EXISTS nota;
```

No toca eventos reales: solo las filas identificadas por `metadata.origen = 'migracion'`.

---

## 3. Backend

| Archivo | Cambio |
|---|---|
| `backend/src/modules/leads/leads.constants.js` | **Nuevo**: `NOTA_MIN = 5`, `NOTA_MAX = 1000` |
| `backend/src/modules/leads/leads.repository.js` | `validarNotaCambioEstado`, `lockById`, `_registrarCambioEstado`; `updateConHistorial` y `convertToContact` usan el escritor único |
| `backend/src/modules/leads/leadsHistory.repository.js` | `nota` en `registrar`; `nota`, `duracionSegundos`, `duracionConfiable`, `esEstadoActual` en `findEvents` |
| `backend/src/modules/leads/leads.schema.js` | `nota` opcional en `updateLeadSchema`; `convertLeadSchema` con nota obligatoria |
| `backend/src/modules/leads/leads.routes.js` | `validate(convertLeadSchema)` en `PATCH /:id/convert` |
| `backend/src/modules/leads/leads.controller.js` | Pasa `nota` a `convertToContact` |
| `backend/migrations/runner.js` | Alta de 142 + guardia de numeración de migraciones |
| `backend/seeds/leads_fase1_prueba.sql` | `SET LOCAL app.permite_borrar_historial = 'on'` antes de limpiar |

### Garantías de diseño

- **Un único escritor de `CAMBIO_ESTADO`:** `_registrarCambioEstado`. Lo usan
  `updateConHistorial` y `convertToContact`; el `CIERRE` derivado también sale de ahí.
- **Atomicidad:** el estado y su evento se escriben en la misma transacción. Si falla la
  auditoría, se revierte el cambio.
- **Concurrencia:** `lockById` usa `SELECT ... FOR UPDATE OF l`; dos cambios simultáneos se
  serializan y la cadena `anterior → nuevo` queda coherente.
- **Defensa en profundidad:** la nota se valida en zod (tipo/tamaño) y en el dominio
  (`validarNotaCambioEstado`, obligatoriedad), de modo que una llamada interna tampoco la omita.
- **SQL parametrizado:** la nota se inserta como parámetro (`$7`), nunca interpolada.

---

## 4. Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/components/Leads/CambiarEstadoModal.jsx` | **Nuevo**: estado + nota obligatoria, contador |
| `frontend/src/components/Leads/ConvertirLeadModal.jsx` | **Nuevo**: sustituye el `window.confirm`; nota obligatoria |
| `frontend/src/components/Leads/LeadForm.jsx` | Al editar, chip de solo lectura; se reenvía el estado actual sin cambio |
| `frontend/src/components/Leads/LeadHistoryTimeline.jsx` | Muestra `nota` y duración; añade `RESTAURACION` al catálogo |
| `frontend/src/pages/Leads/LeadsPage.jsx` | Acción «Cambiar estado» + modal de conversión |
| `frontend/src/pages/Leads/LeadDetailPage.jsx` | Botón «Cambiar estado» en la cabecera + modal |
| `frontend/src/constants/leads.js` | `ESTADOS_LEAD` y `formatearDuracion` |

Detalles de interfaz:

- La acción «Cambiar estado» no ofrece `converted`: para eso está la conversión, que crea el
  contacto y la empresa reales.
- Si se abre sobre un lead ya convertido, obliga a elegir un estado nuevo (placeholder).
- Los errores muestran el mensaje del backend, tanto si vienen de zod como de un `AppError`.
- La duración de los eventos de migración se muestra como
  «Duración no disponible (anterior a la migración)».

---

## 5. Pruebas

### 5.1 Resultado

| Suite | Resultado |
|---|---|
| `src/modules/leads` | **106/106 en verde** (3 suites) |
| Suite completa del backend | **156/180**; 24 fallos preexistentes de `horasExtras` |

Comparación con la línea base (**130/154**): **+26 pruebas, todas en verde**, y los mismos 24
fallos preexistentes (orden de argumentos en `horasExtras`). Sin regresiones.

Las 3 suites que no pasan son preexistentes y ajenas a este cambio:

- `horasExtras.service.test.js` (24 fallos de la línea base).
- `emailMarketing.service.test.js` (no carga `.env`).
- `informes/gestionHumana.test.js` (archivo **sin commitear** del usuario; no se tocó).

### 5.2 Casos añadidos (integración real contra PostgreSQL)

- N1: la nota, el usuario y la fecha quedan en `CAMBIO_ESTADO`.
- N2: cambiar de estado sin nota → 422 y sin rastro.
- N3: nota de menos de 5 → 422.
- N4: reenviar el mismo estado → sin evento y sin nota.
- N5: dos cambios simultáneos → cadena coherente y estado final correcto.
- N6: convertir sin nota → 422; con nota → se guarda.
- N7: duración calculada; el estado actual se distingue.
- N8: las modificaciones no se tratan como entradas de estado.
- N9: `UPDATE` auditado y `DELETE` bloqueados; `metadata` permitido.
- N10: backfill idempotente; nunca dos `CREACION` por lead.

### 5.3 Casos añadidos (API, con repositorio mockeado)

- `PATCH` con cambio de estado propaga la nota.
- `PATCH` con el mismo estado no exige nota.
- `/convert` sin nota o con nota corta → 422.
- `/convert` con nota la propaga al repositorio.
- `/convert` sin permiso → 403.

### 5.4 Unidad

`leadsEstado.test.js`: límites de la nota, mismo estado, estado ausente, error 422 con campo
`nota`, y aceptación literal de intentos de SQLi/XSS (la defensa es parametrizar y escapar).

### 5.5 Otras verificaciones

- `npm run build` (frontend): **correcto**.
- ESLint sobre los archivos frontend modificados: **sin errores**.
- Migración re-ejecutada: idempotente.
- Trigger probado en los tres caminos (bloqueo de `UPDATE` auditado, bloqueo de `DELETE`,
  permiso de `metadata`).

---

## 6. Decisiones y hallazgos

1. **`nota` separada de `description`.** `description` sigue siendo el texto automático del
   sistema; `nota` es lo que escribe el usuario. Así no se mezcla la narración con el dato.
2. **`CIERRE` en conversiones desde un estado terminal.** `dead → converted` ya no genera un
   segundo `CIERRE` (ambos son estados terminales). Sí genera el `CAMBIO_ESTADO` con su nota.
   Es coherente con «el cierre se registra al entrar a un estado terminal».
3. **`RESTAURACION` añadido al catálogo de la línea de tiempo.** Era una omisión de la fase
   anterior: el backend ya lo emitía y el filtro no lo ofrecía.
4. **Bug preexistente corregido en `LeadDetailPage`:** usaba `useMutation` sin importarlo, por lo
   que «Restaurar lead» fallaba en tiempo de ejecución. Se añadió el import.
5. **Memoización de `LeadForm`:** se ajustaron las dependencias del `useMemo` para que el React
   Compiler no descarte la optimización (error de lint preexistente en ese archivo).
6. **Migración huérfana detectada (preexistente):** `068_servicio_fijo.sql` está en
   `_migrations` pero no existe en el repositorio ni en el historial de Git. **No se tocó**;
   requiere decisión (ver §9).

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El trigger rompe pruebas o el seed | Escape `app.permite_borrar_historial` con `SET LOCAL`, solo en pruebas/seed |
| El trigger rompe la anotación del correo | Se permite `UPDATE` de `metadata`; el resto queda bloqueado |
| 3 réplicas duplican el backfill | Índice único parcial + `ON CONFLICT DO NOTHING` |
| Clientes antiguos cambian estado sin nota | 422 explícito; el frontend se actualiza en la misma entrega |
| Duraciones falsas antes de la migración | `duracionConfiable = false` + texto explícito en la UI |
| Nota con HTML/SQL | Se guarda literal; React escapa; SQL parametrizado |
| Renombrar una migración ya aplicada | Guardia en `runner.js` + colisiones históricas 076/129 en allowlist |

---

## 8. Plan de migración y despliegue (manual, Dokploy)

1. **Respaldo de producción** (`pg_dump`) antes de cualquier paso.
2. **Staging** con una copia de producción: aplicar 142 y ejecutar los recorridos de la §5.
3. **Dokploy:** desplegar la imagen de la rama. El contenedor ejecuta
   `npm run migrate && node src/app.js`.
4. **Verificar las 3 réplicas** antes de dar el despliegue por bueno:
   - `/health` responde en las tres.
   - `GET /api/v1/leads/:id/history` devuelve `nota`, `duracionSegundos`,
     `duracionConfiable` y `esEstadoActual`.
   - Un cambio de estado real con nota se ve en la línea de tiempo.
5. **Rollback:** ejecutar el SQL de §2.3 y redeploy de la imagen anterior.

**Sin push a `main` y sin despliegue hasta autorización explícita.**

---

## 9. Lo que necesito para cerrar

1. **Aprobación de la Fase 3** (Gate 3).
2. **Decisión sobre `068_servicio_fijo.sql`:** está aplicada pero no existe el archivo. Opciones:
   - dejarla como huérfana documentada (no afecta al runner), o
   - investigar si el archivo se perdió y restaurarlo desde el entorno donde se aplicó.
   No la eliminé de `_migrations` para no arriesgar una re-ejecución.
3. **Autorización para el push** de la rama y para el despliegue manual en Dokploy.
4. **Respaldo de producción y ventana de despliegue** para las pruebas en staging.
5. Pendientes heredados: autorización para corregir el test de `horasExtras` y decisión sobre
   las credenciales locales hardcodeadas en 10 archivos.
