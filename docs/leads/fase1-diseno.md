# Fase 1 — Diseño técnico del módulo Leads (SOLO LECTURA)

**Proyecto:** CRM interno CARGAR S.A.S. · **Módulo:** Leads
**Fecha:** 2026-10-19 · **Estado:** diseño aprobación — sin escribir código de producción ni aplicar migraciones.
**Gate anterior:** Fase 0 aprobada (GATE 0 ✓).

> **Nota sobre "solo lectura":** la única escritura realizada es la que autorizaste explícitamente:
> el script de datos sintéticos `backend/seeds/leads_fase1_prueba.sql`, ejecutado **únicamente en la
> copia local `prueba_restore`** (1 → 113 filas, todas marcadas con `[SEED-FASE1]`). No se tocó ninguna
> migración, ningún archivo de `src/` ni ninguna otra tabla.
> Limpieza: `DELETE FROM leads WHERE notes LIKE '[SEED-FASE1]%';`

---

## 0. Resumen de decisiones aplicadas

| # | Tu decisión | Cómo se refleja en este diseño |
|---|---|---|
| 1 | Datos sintéticos locales + mapeo de fuentes propuesto | Sección 1 (evidencia de ejecución) y Sección 2.4 |
| 2 | **H** = solo búsqueda de empresa por NIT/nombre (Habeas Data → Fase 2) | Sección 6.5: reutiliza `GET /api/v1/companies?search=` sin tocar Empresas |
| 3 | Bug P2 corregible con 3 condiciones | Sección 4.8: transacción con rollback, sin tocar `NOT NULL`, NIT+dirección obligatorios o empresa existente |
| 4 | No crear rama; reportar `git status` / `git diff --stat` y si hay RBAC ya corregido | Sección 9.1 |
| 5 | "Perdido" = estado `dead` existente (solo etiqueta nueva); motivo obligatorio validado en backend | Secciones 2.3, 4.3, 6.3 |
| 6 | "Asignado a" = cualquier usuario activo; endpoint ligero (id + nombre); por defecto el creador | Secciones 4.7 y 6.4 |
| A+ | RBAC en backend (6 endpoints existentes + 2 nuevos) y **reporte** (sin corregir) de otros módulos | Secciones 4.1 y 9.3 |
| B+ | Validación de entrada explícita por endpoint (crear, editar, convertir) | Sección 4.3 |
| C+ | DELETE físico → borrado lógico con filtro en listados y búsquedas | Secciones 2.6 y 4.9 |
| D+ | Migración **138**; colisiones 076/129 y fila 068 solo se documentan | Sección 9.2 |

### 0.1 Decisiones cerradas sobre las 8 preguntas (2026-10-19)

| # | Pregunta | Decisión | Efecto en el diseño |
|---|---|---|---|
| 1 | Detalle de fuente A/B | **Opción B**: la que siempre conserva el texto original | `source_detail` se rellena en toda fuente que no coincida exactamente con la etiqueta canónica |
| 2 | Fuente vacía | `NULL` en los leads antiguos; **obligatoria en los nuevos**, validada en backend. No forzar `otro` donde nunca hubo dato | Sección 4.3 (`source` pasa a requerido en `createLeadSchema`) |
| 3 | `empresa_id` | **Sí**: FK opcional ligada a la búsqueda del ítem H, conservando también el texto de `company_name` | Sección 2.2 y 6.6 |
| 4 | `score` | Congelado como histórico de solo lectura; se edita y muestra la temperatura | Sección 3 (sin cambios) |
| 5 | Auditoría de duplicados | **Aprobado** excluirlo, mostrando antes el diff exacto de `audit.middleware.js` | Sección 10.3 |
| 6 | Frescura sin job | Aceptable en esta fase; anotado como pendiente de la Fase 2 del módulo | Sección 3 y 13 |
| 7 | Contacto duplicado en conversión | **Avisar y ofrecer vincular** el existente, sin bloquear ni crear duplicado en silencio | Sección 4.8 (flujo de dos pasos) |
| 8 | Umbrales 71/31/30 | Punto de partida, en **una sola constante de configuración**; revisar con datos reales tras unas semanas | Sección 3 |

---

## 1. Datos de prueba (ítem 1) — ejecutado en local

**Script creado:** `backend/seeds/leads_fase1_prueba.sql` (nunca registrado en el runner; ejecución manual).

**Guarda anti-producción (ya implementada y verificada):** el script empieza con un bloque `DO $$` que
lanza una excepción si `current_database()` no coincide con `(prueba|test|dev|local|sandbox|tmp)`.
Probado: corre en `prueba_restore` y se niega en cualquier otra base.

**Destino del fichero (pendiente, 12.1):** se queda hasta terminar la Fase 3 y después se borra con
`DELETE FROM leads WHERE notes LIKE '[SEED-FASE1]%';`. Queda por decidir si se commitea a `main`
(con la guarda) o se queda fuera del repo.

Contenido:
- 100 leads sintéticos con `source` sucia (30 variantes incluyendo `''`, `NULL`, `FB`, `pagina web`,
  `redes sociales`, `campaña`, `no se`), los 5 estados del `CHECK`, teléfono en formatos
  `30…`, `+57 30…`, `5730…` y nulos, correo con mayúsculas y espacios, score histórico 0-100.
- 12 duplicados sintéticos: 4 por correo (mismo correo), 4 por teléfono (mismo número con formato
  `+57 …` distinto), 4 por empresa (mismo nombre en mayúsculas y con espacios).

**Resultado de la ejecución (evidencia):**

| Métrica | Antes | Después |
|---|---|---|
| Filas en `leads` | 1 | 113 (112 marcadas `[SEED-FASE1]`) |

**Validación de la normalización propuesta (Sección 2.4) sobre los 101 leads:**

| Código destino | Filas |
|---|---|
| `web` | 29 |
| `facebook` | 17 |
| `otro` | 12 |
| `llamada` | 9 |
| `instagram` | 7 |
| `whatsapp` | 6 |
| `feria_evento` | 6 |
| `referido` | 6 |
| `cliente_existente` | 6 |
| `NULL` (sin fuente) | 3 |

→ **86 de 101 (85 %) caen en un catálogo canónico; 12 (12 %) van a `otro`; 3 quedan vacíos.**
Los que van a `otro` son exactamente los términos no contemplados (`Otra cosa`, `redes sociales`,
`no se`, `campaña`), que se conservan íntegros en el campo de detalle.

**Validación de duplicados (ítem D) sobre los mismos datos:**

| Tipo | Grupos duplicados detectados |
|---|---|
| Correo normalizado (`lower(btrim(email))`) | 4 |
| Teléfono (dígitos, con/sin prefijo 57) | 4 — p. ej. `+57 3000419707` y `3000419707` colapsan a la misma clave |
| Empresa (`upper(trim(company_name))`) | 7 — p. ej. `EMPRESA DEMO 53`, `  Empresa demo 53 ` |

Plan de ejecución actual (con 113 filas): `Seq Scan` sobre `leads` con coste 9.54. En producción
con más filas se apoyan los índices de la Sección 2.2 (verificación con `EXPLAIN` en Fase 3).

**Consulta de producción que ejecutarás tú** (la documento aquí para que quede junto al diseño):

```sql
SELECT source, count(*) FROM leads GROUP BY source ORDER BY count(*) DESC;
```

Pásame ese resultado antes del despliegue y ajusto el mapeo de la Sección 2.4 a tus valores reales
(los diccionarios están en un solo sitio: un `CASE` en la migración y una constante en el frontend).

---

## 2. Cambios de base de datos — migración `138_leads_mejoras_fase1.sql`

### 2.1 Convención de catálogos: se guardan **códigos**, la interfaz muestra etiquetas

`source`, `temperatura` y `motivo_perdida` se almacenan como **códigos ASCII sin acentos**
(`'facebook'`, `'frio'`, `'sin_interes'`) y el frontend los traduce a etiquetas en un único
constante (`frontend/src/constants/leads.js`).

Motivos:
- Es la convención existente en el repo (`status` = `new|contacted|…`, `companies.regimen` = `RC`).
- Evita repetir el incidente de la migración 039 (`tipo_servicio` se escribió con encoding corrupto
  porque el archivo no era UTF-8). La conexión local es `client_encoding=UTF8`, pero no quiero
  caracteres acentuados viviendo dentro de un `CHECK` si puedo evitarlo.
- Cambiar una etiqueta visible no requiere migración.

### 2.2 Columnas nuevas (aditivas, todas `NULL` por defecto → cero impacto sobre datos existentes)

| Columna | Tipo | Origen |
|---|---|---|
| `source_detail` | `VARCHAR(255)` | ítem A (conserva el texto libre original) |
| `ciudad` | `VARCHAR(100)` | ítem C |
| `cargo` | `VARCHAR(100)` | ítem C |
| `temperatura` | `VARCHAR(10)` + `CHECK` | ítem F |
| `temperatura_puntos` | `SMALLINT` | ítem F (trazabilidad: explica *por qué* es Caliente) |
| `motivo_perdida` | `VARCHAR(50)` + `CHECK` | ítem E |
| `motivo_perdida_detalle` | `TEXT` | ítem E (obligatorio si el motivo es `otro`) |
| `deleted_at` | `TIMESTAMPTZ` | ampliación C+ (borrado lógico) |

**`assigned_to` no se crea: ya existe** (migración 001, FK a `users`). Solo faltan UI, filtro y el
endpoint ligero de usuarios. No se renombra nada, por compatibilidad hacia atrás.

**`empresa_id` se añade** (decisión 3): `UUID REFERENCES companies(id) ON DELETE SET NULL` + índice
parcial `WHERE deleted_at IS NULL AND empresa_id IS NOT NULL`. Se usa para vincular el lead con la
empresa existente elegida en el ítem H. `companies` existe desde la migración 001, así que no hay
problema de orden como sí lo había en el parche de `048` (FK hacia una tabla que se crea después).
Se conserva además el texto en `company_name` (el lead sigue siendo legible aunque la empresa se
archive o se borre). Es una referencia de solo lectura hacia Empresas: **no se modifica esa tabla**.

### 2.3 Restricciones (`CHECK`)

⚠️ **Cambio respecto al diseño inicial (riesgo de despliegue): el `CHECK` de `source` NO entra en la
migración 138.** La validación del catálogo vive en el backend (Sección 4.3) y el `CHECK` se agrega
en una migración posterior, cuando backend y frontend ya estén estables. Así la app anterior nunca
choca contra la base nueva si hay que redesplegar la imagen anterior.

```sql
-- EN 138 (columnas nuevas, sin datos legados que puedan violarlas):
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperatura_check;
ALTER TABLE leads ADD CONSTRAINT leads_temperatura_check
  CHECK (temperatura IS NULL OR temperatura IN ('frio','tibio','caliente'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perdida_check;
ALTER TABLE leads ADD CONSTRAINT leads_motivo_perdida_check
  CHECK (motivo_perdida IS NULL OR motivo_perdida IN (
    'sin_interes','precio_presupuesto','elegio_competencia','sin_presupuesto',
    'no_responde','dato_incorrecto','proyecto_aplazado','perfil_inadecuado','otro'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perdida_detalle_check;
ALTER TABLE leads ADD CONSTRAINT leads_motivo_perdida_detalle_check
  CHECK (motivo_perdida IS DISTINCT FROM 'otro'
     OR (motivo_perdida_detalle IS NOT NULL
         AND length(btrim(motivo_perdida_detalle)) >= 5));

-- EN UNA MIGRACIÓN POSTERIOR (p. ej. 140, tras estabilizar):
-- ALTER TABLE leads ADD CONSTRAINT leads_source_check
--   CHECK (source IS NULL OR source IN (
--     'web','facebook','instagram','whatsapp','referido','llamada',
--     'feria_evento','cliente_existente','otro'));
```

Etiquetas visibles (traduce el frontend):

| Código `source` | Etiqueta | Código `motivo_perdida` | Etiqueta |
|---|---|---|---|
| `web` | Web | `sin_interes` | Sin interés |
| `facebook` | Facebook | `precio_presupuesto` | Precio o presupuesto |
| `instagram` | Instagram | `elegio_competencia` | Eligió la competencia |
| `whatsapp` | WhatsApp | `sin_presupuesto` | Sin presupuesto |
| `referido` | Referido | `no_responde` | No responde |
| `llamada` | Llamada | `dato_incorrecto` | Dato incorrecto o no contactable |
| `feria_evento` | Feria/Evento | `proyecto_aplazado` | Proyecto cancelado o aplazado |
| `cliente_existente` | Cliente existente | `perfil_inadecuado` | No somos el perfil adecuado |
| `otro` | Otro | `otro` | Otro (con detalle) |
| `NULL` | — (sin fuente) | `NULL` | — |

### 2.4 Normalización de los `source` existentes (ítem A)

Regla: lo que no encaje → `otro` **conservando el texto original** en `source_detail` (sin perder
nada); lo que encaje → código canónico.

`NULL` o vacío se queda en `NULL` **solo en los leads legados**: desde la decisión 2, `source` es
**obligatoria en las altas** (validación en backend), así que un lead nuevo sin fuente no se puede
guardar. No se fuerza `otro` donde nunca hubo dato.

**Decisión 1 — Opción B (definitiva):** `source_detail` conserva el texto original **siempre que la
redacción difiere de la etiqueta canónica**, aunque el código se haya acertado (`pagina web` → `web`
+ detalle `pagina web`; `facebook` → `facebook` + detalle `facebook`; `FB` → `facebook` + detalle
`FB`). Cero pérdida de datos, y la interfaz solo muestra el detalle cuando el código es `otro`.
(Queda descartada la Opción A, que rellenaba el detalle únicamente en `otro`.)

La migración solo toca filas cuyo `source` **no es ya un valor del catálogo** (condición
`WHERE source IS NOT NULL AND source NOT IN (…)`), con lo que es **idempotente**: una segunda
ejecución no vuelve a normalizar ni borra los detalles ya escritos.

### 2.5 Índices

```sql
-- Duplicados (ítem D): funciones inmutables -> índice de expresión, sin columnas extra
CREATE INDEX IF NOT EXISTS idx_leads_email_norm
  ON leads (LOWER(BTRIM(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_norm
  ON leads (regexp_replace(phone, '[^0-9]', '', 'g')) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_empresa_norm
  ON leads (UPPER(TRIM(company_name))) WHERE company_name IS NOT NULL;

-- Listado principal (borrado lógico + paginación por cursor sobre created_at)
CREATE INDEX IF NOT EXISTS idx_leads_activos
  ON leads (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_asignado
  ON leads (assigned_to) WHERE deleted_at IS NULL;   -- filtro "Asignado a"
CREATE INDEX IF NOT EXISTS idx_leads_empresa_id
  ON leads (empresa_id) WHERE deleted_at IS NULL AND empresa_id IS NOT NULL;  -- lead -> empresa (ítem H)
```

Se usan índices de expresión en `leads` (tabla del propio módulo) y **no** se crean índices sobre
`contacts` ni `companies` (tablas de otros módulos): se consultan con `LIMIT` sobre tablas pequeñas
(215 contactos / 4.924 empresas en la copia local). Si el `EXPLAIN` de Fase 3 lo desmiente, lo
presento como decisión aparte.

`CREATE INDEX` plano y no `CONCURRENTLY`: el runner envuelve cada archivo en `BEGIN…COMMIT`, y
`CONCURRENTLY` no puede ejecutarse dentro de una transacción. La tabla es pequeña, el bloqueo es
instantáneo.

### 2.6 Borrado lógico y tratamiento del historial existente

- `deleted_at` nace a `NULL` en todas las filas → **todo el historial existente queda visible**; no
  se borra ni se marca nada.
- `DELETE /api/v1/leads/:id` pasa a `UPDATE leads SET deleted_at = NOW()` (físico no se usa nunca más).
- Filtro `AND deleted_at IS NULL` añadido en: listado, detalle, duplicados, conversión y cualquier
  búsqueda. `update` también lo exige (no se edita un lead archivado).
- No hay endpoint de restaurar (fuera de alcance); un admin puede revertirlo con
  `UPDATE leads SET deleted_at = NULL WHERE id = '<uuid>'`.

### 2.7 Temperatura histórica (ítem F, mapeo de scores)

`score` **no se toca** (se congela como histórico legible) y se rellena `temperatura`:

```sql
UPDATE leads
SET temperatura = CASE
  WHEN status = 'dead'      THEN 'frio'
  WHEN status = 'converted' THEN 'caliente'
  WHEN score IS NULL OR score <= 30 THEN 'frio'
  WHEN score <= 70                        THEN 'tibio'
  ELSE 'caliente'
  END,
  temperatura_puntos = score
WHERE temperatura IS NULL;
```

Los umbrales 30/70 son exactamente los que ya usa la UI del score actual
(`>70` verde, `>30` amarillo, resto rojo): se preserva el significado que el usuario ya tenía en
la cabeza. `dead`→`frio` y `converted`→`caliente` se cortan por delante para que un lead muerto con
score 97 no aparezca como Caliente.

### 2.8 SQL completo de la migración 138

```sql
-- ============================================================
-- Migración 138: Módulo Leads — Fase 1
--   A) Catálogo de fuentes + conservación del texto original
--   C) Campos ciudad y cargo
--   E) Motivo de pérdida obligatorio
--   F) Temperatura calculada (columna + puntos)
--   C+) Borrado lógico (deleted_at) e índices de duplicados
-- Idempotente. No toca tablas de otros módulos ni restricciones
-- NOT NULL existentes.
-- ============================================================

-- ── 1. Columnas nuevas (aditivas, default NULL) ──────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source_detail          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ciudad                 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cargo                  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS temperatura            VARCHAR(10),
  ADD COLUMN IF NOT EXISTS temperatura_puntos     SMALLINT,
  ADD COLUMN IF NOT EXISTS motivo_perdida         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS motivo_perdida_detalle TEXT,
  ADD COLUMN IF NOT EXISTS empresa_id             UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at             TIMESTAMPTZ;

-- ── 2. Normalización de las fuentes existentes ───────────────
-- Solo se tocan filas cuyo source NO es ya un valor del catálogo
-- (garantiza idempotencia y no pisa los detalles ya escritos).
WITH normalizado AS (
  SELECT id,
    CASE
      WHEN lower(TRIM(source)) IN ('web','www','pagina web','página web','pagina-web',
            'página-web','sitio web','web site','site','portal','landing','landing page',
            'google','buscador','formulario web','pagina corporativa')       THEN 'web'
      WHEN lower(TRIM(source)) IN ('fb','face','facebook','meta','anuncio facebook') THEN 'facebook'
      WHEN lower(TRIM(source)) IN ('ig','insta','instagram')                 THEN 'instagram'
      WHEN lower(TRIM(source)) IN ('whats','wpp','wa','whatsapp')            THEN 'whatsapp'
      WHEN lower(TRIM(source)) IN ('referido','referidos','recomendacion','recomendación',
            'recomendado','boca a boca','cruzado')                           THEN 'referido'
      WHEN lower(TRIM(source)) IN ('llamada','llamada entrante','llamada saliente',
            'llamada fria','telefono','teléfono','telefono entrante','call')  THEN 'llamada'
      WHEN lower(TRIM(source)) IN ('feria','evento','feria/evento','exposicion',
            'exposición','congreso','stand')                                 THEN 'feria_evento'
      WHEN lower(TRIM(source)) IN ('cliente','clientes','cliente existente','cliente actual',
            'cliente activo','cartera propia','upsell','cross sell')          THEN 'cliente_existente'
      ELSE 'otro'
    END AS codigo,
    TRIM(source) AS original
  FROM leads
  WHERE source IS NOT NULL
    AND source NOT IN ('web','facebook','instagram','whatsapp','referido','llamada',
                       'feria_evento','cliente_existente','otro')
)
UPDATE leads l
SET source = n.codigo,
    source_detail = CASE
      WHEN n.codigo = 'otro' THEN n.original
      WHEN lower(n.original) = lower(CASE n.codigo
             WHEN 'web'              THEN 'Web'
             WHEN 'facebook'         THEN 'Facebook'
             WHEN 'instagram'        THEN 'Instagram'
             WHEN 'whatsapp'         THEN 'WhatsApp'
             WHEN 'referido'         THEN 'Referido'
             WHEN 'llamada'          THEN 'Llamada'
             WHEN 'feria_evento'     THEN 'Feria/Evento'
             WHEN 'cliente_existente' THEN 'Cliente existente' END) THEN NULL
      ELSE n.original
    END
FROM normalizado n
WHERE l.id = n.id;

-- ── 3. Restricciones de catálogo ─────────────────────────────
-- NOTA: el CHECK de `source` NO se agrega aquí a propósito. El catálogo
-- se valida en el backend (leads.schemas.js); el CHECK se añadirá en una
-- migración posterior cuando backend y frontend estén estables, para que
-- la versión anterior de la app nunca choque contra la base nueva.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperatura_check;
ALTER TABLE leads ADD CONSTRAINT leads_temperatura_check
  CHECK (temperatura IS NULL OR temperatura IN ('frio','tibio','caliente'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perdida_check;
ALTER TABLE leads ADD CONSTRAINT leads_motivo_perdida_check
  CHECK (motivo_perdida IS NULL OR motivo_perdida IN (
    'sin_interes','precio_presupuesto','elegio_competencia','sin_presupuesto',
    'no_responde','dato_incorrecto','proyecto_aplazado','perfil_inadecuado','otro'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perdida_detalle_check;
ALTER TABLE leads ADD CONSTRAINT leads_motivo_perdida_detalle_check
  CHECK (motivo_perdida IS DISTINCT FROM 'otro'
     OR (motivo_perdida_detalle IS NOT NULL
         AND length(btrim(motivo_perdida_detalle)) >= 5));

-- ── 4. Temperatura inicial para los leads legados ────────────
UPDATE leads
SET temperatura = CASE
  WHEN status = 'dead'      THEN 'frio'
  WHEN status = 'converted' THEN 'caliente'
  WHEN score IS NULL OR score <= 30 THEN 'frio'
  WHEN score <= 70                        THEN 'tibio'
  ELSE 'caliente'
  END,
  temperatura_puntos = COALESCE(score, 0)
WHERE temperatura IS NULL;

-- ── 5. Índices ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_email_norm
  ON leads (LOWER(BTRIM(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_norm
  ON leads (regexp_replace(phone, '[^0-9]', '', 'g')) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_empresa_norm
  ON leads (UPPER(TRIM(company_name))) WHERE company_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_activos
  ON leads (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_asignado
  ON leads (assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_empresa_id
  ON leads (empresa_id) WHERE deleted_at IS NULL AND empresa_id IS NOT NULL;

-- ── 6. Comentarios de diccionario ────────────────────────────
COMMENT ON COLUMN leads.empresa_id IS
  'Empresa existente elegida al capturar el lead (ítem H). company_name conserva el texto';
COMMENT ON COLUMN leads.source IS
  'Catálogo: web, facebook, instagram, whatsapp, referido, llamada, feria_evento, cliente_existente, otro';
COMMENT ON COLUMN leads.source_detail IS
  'Texto libre original cuando no coincidía con la etiqueta canónica; obligatorio si source=otro';
COMMENT ON COLUMN leads.temperatura IS
  'Calculada por backend (frio/tibio/caliente). No editable por usuario';
COMMENT ON COLUMN leads.motivo_perdida IS
  'Obligatorio cuando status=dead ("Perdido")';
COMMENT ON COLUMN leads.deleted_at IS
  'Borrado lógico: NULL = activo';
COMMENT ON COLUMN leads.score IS
  'LEGADO congelado: scoring manual histórico 0-100. Ya no se escribe';
```

### 2.9 Alta en el runner

`backend/migrations/runner.js` → array `MIGRATION_FILES`, **una línea** después de `137`:

```js
  '138_leads_mejoras_fase1.sql',
```

Sobre el inventario de migraciones (Fase 0, sin cambios): 139 archivos en disco = 139 entradas en
`MIGRATION_FILES` = 140 filas en `_migrations`. Con la 138: 140 en disco = 140 = 141 filas.
Sigue sin existir ningún mecanismo que impida añadir un archivo sin registrarlo (riesgo `P13` de
Fase 0, no abordado en esta fase).

---

## 3. Regla de temperatura (ítem F)

Función pura y determinista, en `backend/src/modules/leads/leads.temperatura.js`:

```js
calcularTemperatura(lead, ahora = new Date())  //  -> { codigo, puntos }
```

**Cortes cortos (ganan sin sumar):**

| Condición | Resultado |
|---|---|
| `status === 'dead'` | `frio` (0 puntos) |
| `status === 'converted'` | `caliente` (100 puntos) |

**En caso contrario, suma de 4 señales (0-100):**

| Señal | Condición | Puntos | Máx. |
|---|---|---|---|
| **1. Estado** | `new` → 0 · `contacted` → 15 · `qualified` → 40 | | 40 |
| **2. Frescura** | días desde `created_at` ≤ 7 → 10 · 8-30 → 5 · > 30 → 0 | | 10 |
| **3. Completitud** | email válido → 10 · teléfono (≥7 dígitos) → 10 · empresa → 5 · ciudad → 5 | | 30 |
| **4. Fuente** | `referido`, `cliente_existente` → 20 · `llamada`, `whatsapp` → 15 · `feria_evento` → 10 · `web`, `instagram`, `facebook` → 5 · `otro`/`NULL` → 0 | | 20 |

**Tramo → etiqueta:** `≥ 71` **Caliente** · `31-70` **Tibio** · `≤ 30` **Frío**.

**Los umbrales y los pesos viven en una sola constante de configuración** exportada por
`leads.temperatura.js` (decisión 8), no incrustados en el código:

```js
export const UMBRALES_TEMPERATURA = { CALIENTE: 71, TIBIO: 31 };   // >= CALIENTE | >= TIBIO | resto
export const PESOS_TEMPERATURA = { /* estado, frescura, completitud, fuente */ };
```

Son el punto de partida, heredado de los umbrales del score actual (30/70) que ya usan los usuarios.
**Revisión:** con los datos reales de producción tras unas semanas, se ajustan en un solo archivo sin
tocar la lógica. Queda anotado como tarea de seguimiento de la Fase 2 del módulo.

Ejemplos calibrados:
- `new` + 45 días + correo y teléfono + fuente `web` = 0+0+20+5 = **25 → Frío**.
- `new` + 3 días + datos completos + `referido` = 0+10+30+20 = **60 → Tibio**.
- `contacted` + 5 días + completos + `whatsapp` = 15+10+30+15 = **70 → Tibio** (a borde).
- `contacted` + 5 días + completos + `referido` = 15+10+30+20 = **75 → Caliente**.
- `qualified` + completos + `web` = 40+10+30+5 = **85 → Caliente**.

**Dónde se calcula y cuándo se recalcula:** en el backend, al crear, en **todo** `PATCH` (sin mirar
qué campos cambiaron: es una función barata y evita estados inconsistentes) y en la conversión.
`temperatura` y `temperatura_puntos` se escriben junto al lead; el frontend solo los pinta.

**Limitación aceptada para esta fase (decisión 6):** la frescura se evalúa en el momento del último
guardado. Sin un job diario, un lead sin movimiento conserva los puntos de frescura del día en que
se editó por última vez. Un `node-cron` que recalcula todos los leads una vez al día son ~10 líneas.
**Queda anotado como pendiente de la Fase 2 del módulo.**

**`score` queda congelado:** ya no se escribe ni se acepta en la API (el esquema lo descarta). Se
conserva la columna y su valor histórico como "scoring legado" (decisión 4).

---

## 4. Contrato de API

### 4.1 RBAC (ampliación A+) — `verificarPermiso` por endpoint

`verificarPermiso(modulo, accion)` en `backend/src/middleware/auth.js` ya está implementado y en uso
en `contabilidad` y `facturacion`. Los 6 endpoints de Leads pasan de solo `authenticate` a
`authenticate` + permiso:

| Endpoint | Permiso |
|---|---|
| `GET /api/v1/leads` | `leads/ver` |
| `GET /api/v1/leads/:id` | `leads/ver` |
| `POST /api/v1/leads` | `leads/crear` |
| `PATCH /api/v1/leads/:id` | `leads/editar` |
| `PATCH /api/v1/leads/:id/convert` | `leads/editar` |
| `DELETE /api/v1/leads/:id` | `leads/eliminar` |
| `POST /api/v1/leads/duplicados` (nuevo) | `leads/ver` |
| `GET /api/v1/leads/asignables` (nuevo) | `leads/ver` |

**Impacto real verificado en la copia local** (todos los roles tienen fila en `modulos_sistema` para
`leads`; si no la tienen, el middleware deniega):

| Rol | Usuarios activos | ver/crear/editar/eliminar |
|---|---|---|
| admin | 3 | ✓ ✓ ✓ ✓ |
| aprobador_1 | 3 | ✓ ✓ ✓ ✓ |
| mantenimiento | 2 | ✓ ✓ ✓ ✓ |
| contabilidad | 1 | ✓ ✓ ✓ ✗ |
| facturador | 1 | ✓ ✓ ✓ ✓ |
| gerencia | 1 | ✓ ✗ ✗ ✗ |
| gestion_humana | 1 | ✓ ✗ ✗ ✗ |
| resto de roles (11) | 0 | ✗ ✗ ✗ ✗ |

→ **Ningún usuario activo pierde acceso legítimo.** Los 2 usuarios que hoy podían escribir vía API
sin permiso en la UI (gerencia, gestion_humana) dejan de poderlo: eso es exactamente el bug `P1`.

El cache de permisos (`obtenerPermisosUsuario`, TTL 300 s) implica hasta 5 minutos de demora para
cambios de rol hechos en caliente; es el comportamiento actual y no se toca.

### 4.2 Estados y motivo de pérdida (ítem E)

- `status` sigue siendo `new | contacted | qualified | converted | dead`. **No se crea ningún estado.**
- La etiqueta visible de `dead` pasa de "Descartado" a **"Perdido"** (frontend, constante única).
- Regla: **si en el cuerpo de la petición `status === 'dead'`**, `motivo_perdida` es obligatorio y, si
  es `otro`, `motivo_perdida_detalle` (5-1000 caracteres). Se valida en `zod` **y** en el `CHECK` de BD.
- Si el cuerpo trae `status` distinto de `dead`, el backend limpia `motivo_perdida` y
  `motivo_perdida_detalle` a `NULL` (mismo patrón que el motivo de anulación de Servicios).
- Migración: los leads `dead` legados quedan con `motivo_perdida = NULL`; se mostrarán como
  "Sin motivo registrado" y el backend pedirá motivo en cuanto se envíe `status: 'dead'` en una
  edición (con el formulario completo de React eso ocurre siempre, así que se autocurará).

### 4.3 Validación y sanitización (ampliación B+)

Nuevo `backend/src/modules/leads/leads.schemas.js` (convención `*.schema.js` ya usada en
`proveedores`), aplicado con el middleware `validate` existente (`backend/src/middleware/validate.js`).

`sanitizeTexto(v)`: `trim` + colapsa espacios + elimina caracteres de control + elimina etiquetas
HTML (`/<[^>]*>/g`). Se aplica a `first_name`, `last_name`, `company_name`, `ciudad`, `cargo`,
`source_detail`, `motivo_perdida_detalle` y (conservando saltos de línea) a `notes`.

`zod` **descarta** las claves no declaradas (comportamiento por defecto, `.strip()`), de modo que
`score`, `temperatura`, `temperatura_puntos`, `id`, `deleted_at`, `created_at` y
`converted_contact_id` **nunca** llegan al repositorio aunque un cliente los envíe. El repositorio
mantiene además su propia lista blanca de columnas.

Esquemas:

**`createLeadSchema`**

| Campo | Regla |
|---|---|
| `first_name` | requerido, sanitizado, 2-100 |
| `last_name` | opcional, ≤100 |
| `email` | opcional: `''`, `null` o email válido ≤255 (normalizado a minúsculas) |
| `phone` | opcional, ≤30, solo `+0-9 ().-` |
| `company_name` | opcional, ≤255 |
| `empresa_id` | `uuid` o nulo; si viene, el backend verifica que la empresa exista y no esté archivada (422 si no) |
| `source` | **requerido** en alta (decisión 2): `enum` de catálogo. Los leads legados pueden seguir en `NULL` |
| `source_detail` | opcional, ≤255; **requerido** si `source === 'otro'` |
| `status` | `enum`, por defecto `new` |
| `assigned_to` | `uuid` o nulo; si no viene → `req.userId` |
| `ciudad`, `cargo` | opcional, ≤100 |
| `campaign_id` | `uuid` o nulo |
| `notes` | opcional, ≤5000 |
| `motivo_perdida`, `motivo_perdida_detalle` | condicionales a `status === 'dead'` |
| *(todo lo demás)* | **se descarta** |

**`updateLeadSchema`**: mismo campo que el anterior, todos opcionales, más:
- si viene `status === 'dead'` → exige `motivo_perdida` (+ detalle si `otro`);
- si viene `status` ≠ `dead` → limpia motivo y detalle a `NULL`;
- si no viene `status` → no se toca el motivo (editar el teléfono de un lead muerto no lo bloquea… aunque
  el frontend envía el formulario completo, ver §4.2).

**`convertLeadSchema`**: ver §4.8.
**`listQuerySchema`**: `status`, `assignedTo`, `source`, `search` (≤100), `limit` (1-200, por defecto 50),
`cursor` (uuid), `sortBy`, `sortOrder`.
**`duplicadosSchema`**: ver §4.7.

### 4.4 Endpoints (resumen)

| # | Método y ruta | Permiso | Éxito | Errores |
|---|---|---|---|---|
| 1 | `GET /api/v1/leads` | `leads/ver` | 200 `{success,data,pagination}` | 401, 403, 422, 429 |
| 2 | `GET /api/v1/leads/:id` | `leads/ver` | 200 `{success,data}` | 401, 403, 404, 422 |
| 3 | `POST /api/v1/leads` | `leads/crear` | 201 | 401, 403, 422, 429 |
| 4 | `PATCH /api/v1/leads/:id` | `leads/editar` | 200 | 401, 403, 404, 422 |
| 5 | `PATCH /api/v1/leads/:id/convert` | `leads/editar` | 200 | 400, 401, 403, 404, 409, 422 |
| 6 | `DELETE /api/v1/leads/:id` | `leads/eliminar` | 200 | 401, 403, 404 |
| 7 | `POST /api/v1/leads/duplicados` | `leads/ver` + `searchLimiter` | 200 | 401, 403, 422, 429 |
| 8 | `GET /api/v1/leads/asignables` | `leads/ver` | 200 | 401, 403 |

El catálogo de fuentes y motivos **no** expone endpoint: vive en `leads.schemas.js` (backend) y en
`frontend/src/constants/leads.js` (frontend). Un valor nuevo exige migración por el `CHECK`, así que
un endpoint no aportaría independencia; sí evita un punto de ataque más.

### 4.5 `GET /leads/asignables` (decisión 6)

```json
// 200
{ "success": true,
  "data": [ { "id": "0e9c…", "nombre": "Ana Pérez" } ] }
```

`SELECT id, TRIM(nombre || ' ' || COALESCE(apellido,'')) AS nombre FROM users WHERE estado='ACTIVO'
ORDER BY nombre LIMIT 200` — **solo id y nombre**, sin correo, sin rol, sin estado. Protegido por
`leads/ver` (quien puede ver leads necesita saber a quién se le asigna).

### 4.6 Responsable por defecto

Si `POST /leads` no trae `assigned_to`, el backend lo fija en `req.userId`. Si lo trae, se valida que
el usuario exista y esté `ACTIVO` (422 si no). No hay restricción de "solo equipo comercial":
cualquier usuario activo es asignable.

### 4.7 Duplicados (ítem D) — `POST /api/v1/leads/duplicados`

**Por qué `POST` y no `GET`:** `morgan` registra `req.originalUrl`; con `GET ?email=…` el correo
quedaría escrito en el log de acceso. Con `POST` solo queda la ruta.

```json
// Petición: al menos un criterio
{ "email": "ana@acme.com", "telefono": "3001234567", "empresa": "ACME" }

// 200 — respuesta mínima, sin PII de más, sin conteos globales, sin fechas
{ "success": true,
  "leads":     [ { "id": "…", "nombre": "Ana Pérez" } ],
  "contactos": [ { "id": "…", "nombre": "Ana Pérez" } ],
  "empresas":  [ { "id": "…", "nombre": "ACME S.A.S." } ] }
```

Claves de comparación:

| Criterio | Leads | Contactos | Empresas |
|---|---|---|---|
| Correo | `LOWER(BTRIM(email)) = $1` | idem sobre `contacts` | — |
| Teléfono | `regexp_replace(phone,'[^0-9]','') IN ($1, '57'||$1)` | idem | — |
| Empresa / NIT | `UPPER(TRIM(company_name)) = UPPER($1)` | — | `nit = $1` (índice único) o `UPPER(TRIM(name)) = UPPER($1)` |

**Protección contra enumeración:**
1. `searchLimiter` (30 peticiones/minuto por usuario, el mismo de Búsqueda Global) — **sin tocar**
   `rateLimiter.js`.
2. Mínimos de longitud: correo válido (zod), teléfono ≥7 dígitos, empresa ≥3 caracteres. Sin criterios
   → 422.
3. `LIMIT 5` por sección: nunca se devuelven conteos agregados.
4. Respuesta mínima: solo `id` + `nombre` (más `nombre` de empresa). No correo, no teléfono, no
   fechas, no notas, no estado.
5. Excluye leads archivados (`deleted_at IS NULL`).
6. El frontend llama con *debounce* de 600 ms y solo con un campo ya válido.

### 4.8 Conversión (bug P2) — con tus 3 condiciones

`PATCH /api/v1/leads/:id/convert`:

```json
// Opción A: empresa existente
{ "empresa_existente_id": "uuid", "contacto": { "email": "…", "telefono": "…", "cargo": "…" } }

// Opción B: empresa nueva (NIT y dirección obligatorios — no se inventan valores por defecto)
{ "empresa": { "nombre": "ACME S.A.S.", "nit": "900123456-1",
               "direccion": "Cra 7 # 72-41", "ciudad": "Bogotá" },
  "contacto": { "email": "ana@acme.com", "telefono": "3001234567" } }
```

Reglas: exactamente una de las dos variantes (superRefine), 422 en caso contrario.

Flujo, **dentro de una única transacción** (`withTransaction`, ya existente):

1. `SELECT … FROM leads WHERE id=$1 AND deleted_at IS NULL FOR UPDATE` → 404 si no existe.
2. Si `status === 'converted'` → **409** "Este lead ya fue convertido".
3. Empresa: si `empresa_existente_id`, se valida que exista y no esté archivada (404 si no). Si es
   nueva, se comprueba que el NIT no exista → **409** con el `empresa_id` existente.
   `INSERT INTO companies (name, nit, address, city, regimen, country)` usando los valores
   **por defecto de la columna** de `regimen` y `country`; **no se altera ningún `NOT NULL`**.
4. Contacto: **decisión 7 — avisar, no duplicar en silencio**. El backend busca un contacto con el
   mismo correo (normalizado) en la empresa elegida:
   - si lo encuentra **y** el cuerpo no trae decisión explícita → **409** con
     `{ codigo:'contacto_duplicado', contacto_id, nombre }`; el frontend muestra
     "Ya existe un contacto con ese correo en esta empresa: ¿vincularlo o crear uno nuevo?" y reintenta;
   - si el cuerpo trae `contacto_existente_id` → se **vincula** ese contacto (sin crear nada nuevo);
   - si el cuerpo trae `ignorar_contacto_duplicado: true` → se crea un contacto nuevo (el usuario
     decidió a sabiendas; nunca queda oculto);
   - si no hay coincidencia → `INSERT INTO contacts` (los `NOT NULL` de `contacts` se satisfacen con
     `first_name` y `company_id`; el resto va a `notes`).

   Ninguna de las dos ramas bloquea el flujo y ninguna crea un duplicado sin que el usuario lo decida.
5. `UPDATE leads SET status='converted', converted_contact_id=…, updated_at=NOW()`.
6. `COMMIT`. **Cualquier error en cualquier paso → `ROLLBACK` completo → 400** (o 409 por conflicto de
   NIT): no queda empresa creada sin contacto ni lead convertido a medias.

Mantengo el método `PATCH` (no `POST`) para no romper el contrato actual que consume `LeadsPage`.

### 4.9 Borrado lógico (ampliación C+)

`DELETE /:id` → `UPDATE leads SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL
RETURNING id` → 200 `{success:true, message:'Lead archivado'}`. Sigue auditándose (escritura de 2xx).
El listado, el detalle, los duplicados y la conversión filtran `deleted_at IS NULL`.

---

## 5. Normalización de teléfono y correo (formato colombiano)

Funciones puras en `backend/src/modules/leads/leads.normalizacion.js` (el repo no tiene ninguna
equivalente; Email Marketing tampoco normaliza).

**Correo:** `lower(trim(x))`. El `CHECK` de formato lo pone `zod` (no se pierde nada: si es inválido,
422 y el usuario lo corrige antes de guardar).

**Teléfono:**
1. Eliminar todo lo que no sea dígito (`+`, espacios, `(`, `)`, `-`, `.`) → clave `d`.
2. Si `d` tiene 12 dígitos y empieza por `57` → quitar el prefijo → 10 dígitos.
3. El resto se conserva tal cual (fijos de 7 u 8 dígitos, formatos no estándar): **no se pierde nada**.
4. El valor guardado en `phone` sigue siendo el texto original tal como lo escribió el usuario
   (compatibilidad con lo que ya existe); la clave normalizada es solo para comparar.

Consulta de duplicados: `regexp_replace(phone,'[^0-9]','') IN ($1, '57'||$1)` — cubre de forma
indexable tanto el número guardado a 10 dígitos como el guardado con prefijo `57`, sin necesidad de
función ni columna generada. (Validado en local: `+57 3000419707` y `3000419707` colapsan al mismo
grupo.)

---

## 6. Diseño de la interfaz

### 6.1 Modal de creación/edición en dos niveles

Nivel 1 — **Datos de contacto**: nombre*, apellidos, correo, teléfono, empresa, `cargo`, `ciudad`,
fuente*, responsable* (combobox), campaña, notas.
Nivel 2 — **Seguimiento**: estado*, motivo de pérdida (solo si el estado es Perdido), temperatura
(**solo lectura**, calculada en backend; se muestra el tramo y, en texto pequeño, "calculada con 75
puntos"), score legado solo si `score > 0`, y "Empresa vinculada".

Cabecera con pestañas "Datos de contacto" / "Seguimiento" y un indicador de errores pendientes por
pestaña. Al enviar, si hay errores en la otra pestaña, salta a ella y marca los campos (los mensajes
son en línea y además un resumen al pie).

### 6.2 Visibilidad, contraste y validaciones en línea

Archivo nuevo `frontend/src/components/Leads/leads.css`, importado por `LeadForm.jsx`, con reglas
**ancladas a `.lead-form`** (p. ej. `.lead-form .input-label { color: var(--text-primary); font-weight: 600 }`,
`.lead-form .input::placeholder { color: var(--text-secondary); opacity: 1 }`, `.lead-form .field-error
{ color: var(--clr-danger); font-size: var(--text-xs) }`).

**No se modifica `frontend/src/index.css`** (CSS global compartido por 18 páginas; cambiar el
placeholder de todas ellas no es un cambio de módulo y requiere aviso previo). Si prefieres que el
mejor de contraste sea global, dilo y lo cambio en el archivo compartido con tu gate.

Validaciones: onBlur y al enviar, con el texto de `zod` en español (Colombia) bajo el campo y borde
`--clr-danger`; `required` marcado con `*`. Para `source_detail`: aparece solo cuando la fuente es
"Otro".

### 6.3 Estados y motivo de pérdida

- El desplegable de estado usa las etiquetas de la constante: **"Perdido"** en lugar de "Descartado".
- Al elegir "Perdido" se abre `ModalMotivoPerdida` (radios + textarea; el textarea solo es obligatorio
  si el motivo es "Otro", con contador 5-1000). "Cancelar" revierte el desplegable al estado anterior.
  El modal sigue el patrón de `RemisionFormPage.jsx` (líneas 1155-1178), que es el precedente de
  "motivo obligatorio" en el repo.
- Los mensajes: "El motivo de la pérdida es obligatorio", "Describe el motivo (mínimo 5 caracteres)".

### 6.4 Lista y filtros

- Columna nueva **Temperatura** con pastilla: Frío `#0ea5e9`/`#075985`, Tibio `#f59e0b`/`#92400e`,
  Caliente `#dc2626`/`#7f1d1d` (paleta ya existente, texto sobre fondo al 10 %).
- Se elimina la barra de score manual; se conserva "Scoring legado" en el detalle.
- Filtro **"Asignado a"** (combobox `GET /leads/asignables` + "Todos") → `assignedTo`, y
  "Mios" sigue funcionando igual.
- Filtros existentes (estado, campaña, orden) intactos; la columna "Fuente" muestra la etiqueta.
- "Eliminar" pasa a archivar: `window.confirm('¿Archivar este lead?' …)`.

### 6.5 Aviso de duplicados (ítem D)

`AvisoDuplicados.jsx`: banner ámbar dentro del formulario (no modal, no bloqueante) con los
coincidencias agrupadas (Leads / Contactos / Empresas) y enlaces a cada registro. Se muestra solo en
alta, o en edición si cambió el correo, el teléfono o la empresa. Botón "Continuar de todos modos" que
lo descarta para esa sesión. Se consulta con *debounce* de 600 ms.

### 6.6 Búsqueda de empresa por NIT/nombre (ítem H)

`BuscadorEmpresa.jsx` (autocompletado) que consume **sin cambios** el endpoint existente
`GET /api/v1/companies?search=<nit|nombre>&limit=8` — `companies.repository.findAll` ya busca
`name ILIKE` **o** `nit ILIKE` y ya filtra `deleted_at IS NULL`. Al elegir una empresa se rellenan
`company_name` (el texto) **y** `empresa_id` (la referencia, decisión 3); si el usuario escribe a
mano, `empresa_id` queda en `NULL` y solo se guarda el texto. En la conversión, el mismo componente
sirve para "empresa existente".

**No se modifica el módulo Empresas** (solo lectura). Dato heredado del análisis: `companies` no
aplica RBAC en su endpoint de listado, así que cualquier usuario autenticado puede consultarlo; queda
anotado en el reporte de la Sección 9.3, no se corrige aquí.

### 6.7 Etiquetas y mensajes

Todo en español (Colombia). Los mensajes de error del backend (`errors.js`) devuelven
`error.message` en español: se usarán textos explícitos por caso
("Debe indicar el motivo de la pérdida", "El NIT ya está registrado en otra empresa", "Este lead ya
fue convertido").

---

## 7. Plan de pruebas

Conventions actuales: Jest ESM (`jest.config.mjs`, `roots: src`), mocks con `jest.unstable_mockModule`
(servicios.test.js), `supertest` contra la app.

### 7.1 Unitarios (funciones puras, sin mocks)

**`leads.temperatura.test.js`**
- `dead` → `frio` con 0 puntos aunque el resto sume 100.
- `converted` → `caliente` con 100 puntos.
- Límites: 71 → Caliente, 70 → Tibio, 31 → Tibio, 30 → Frío.
- Cada señal por separado (estado, frescura 7/8/30/31 días, completitud con cada campo ausente,
  cada fuente).
- Mismo resultado para la misma entrada (determinismo).

**`leads.normalizacion.test.js`**
- Correo: mayúsculas, espacios, `null`, cadena vacía.
- Teléfono: `3001234567`, `+57 3001234567`, `573001234567`, `(1) 234 5678`, `300-123-4567`,
  `abc123`, `null` → claves esperadas; el texto original se conserva.
- `sanitizeTexto`: `<script>alert(1)</script>`, `<b>Hola</b>`, caracteres de control, espacios
  repetidos, saltos de línea preservados en `notes`.

**`leads.schemas.test.js`**
- `create` válido → pasa con `assigned_to` por defecto.
- Rechaza: email inválido, `first_name` de 1 carácter, `source` fuera del catálogo, `phone` con letras.
- `status: 'dead'` sin `motivo_perdida` → error; con `otro` sin detalle → error; con detalle de
  4 y de 5 caracteres → error / pasa.
- `status` ≠ `dead` → limpia `motivo_perdida` y `motivo_perdida_detalle`.
- **Mass assignment**: envío con `score`, `temperatura`, `id`, `deleted_at`, `converted_contact_id`
  → esas claves no aparecen en el objeto parseado.

### 7.2 Integración (supertest + app con mocks)

**Seguridad**
- Sin token → 401 en los 8 endpoints.
- Rol con `ver` pero sin `crear` → `POST /leads` 403; rol sin `ver` → `GET /leads` 403; sin
  `eliminar` → `DELETE` 403.
- Inyección: `GET /leads?search='; DROP TABLE leads; --` → 200 sin resultados y la tabla sigue
  viva (todas las consultas parametrizadas).
- XSS: `notes = '<script>…</script>'` → 201 y el valor persistido sin etiquetas.
- `POST /leads` con `temperatura: 'caliente'` y `score: 100` en el cuerpo → 201 y en BD
  `temperatura` es la que calculó la regla, no la enviada.
- `POST /leads/duplicados` sin criterios → 422; con criterio corto → 422; respuesta sin campos
  sensibles; excluye archivados.

**Funcionales**
- Listado: filtros `status`, `assignedTo`, `source`; `limit` respetado; `deleted_at IS NULL`.
- Crear sin `assigned_to` → se asigna al creador.
- Editar a `dead` con motivo → 200 y persistido; salir de `dead` → motivo a `NULL`.
- Archivar → 200; `GET /:id` → 404; el lead no aparece en listado ni en duplicados.
- Conversión: empresa nueva sin NIT → 422; con NIT duplicado → 409 y **sin** empresa creada
  (rollback); empresa existente → 200 con contacto; segundo intento sobre el mismo lead → 409.
- Repo `convertToContact` con `withTransaction` mockeado que lanza tras el `INSERT` de `companies` →
  se verifica que no se ejecuta `COMMIT` y que sí se ejecuta `ROLLBACK`.

**Legados**
- Un lead con `source` cruda, `score` 97 y `status` `qualified` sigue siendo legible por la API
  (compatibilidad hacia atrás).

### 7.3 Suite existente

`npm test` (workspace backend) debe seguir en verde. Ojo con un hallazgo lateral: el test
`backend/tests/unit/emailMarketing.service.test.js` **no se ejecuta** porque `jest.config.mjs` limita
`roots` a `<rootDir>/src`. Lo anoto aquí como observación; no lo toco.

---

## 8. Migración y rollback

**Paso previo obligatorio (decisión de riesgo): respaldo de la tabla antes de desplegar.**

```bash
pg_dump "$DATABASE_URL" -t leads -Fc -f leads_pre_138.dump
# y copia fuera del servidor (bucket/S3/disco externo), no en el mismo host que la BD
```

Cubre el caso de que `source_detail` se pierda en un rollback completo (Sección 2.4). Se verifica
con `pg_restore --list leads_pre_138.dump` antes de continuar. Se anota en el acta del despliegue
junto a la fecha y el commit desplegado.

**Orden de despliegue (regla existente):** backend primero. El runner ejecuta `npm run migrate`
antes de arrancar la app; si la migración falla, el proceso termina con código 1 y el contenedor no
arranca, quedando activa la versión anterior. Migración + despliegue en la misma ventana de mantenimiento.

**Si falla a mitad:** el runner envuelve cada archivo en `BEGIN … COMMIT` y hace `ROLLBACK` si algo
falla. Resultado: la BD queda exactamente como antes y `_migrations` no registra la 138. No se
pierde ningún dato (todo lo que hace la migración es aditivo o un `UPDATE` sobre columnas que nacen
en esa misma migración).

**Si la migración funciona pero la app nueva tiene un defecto:** se redespliega la imagen anterior.
La BD queda con las columnas nuevas (todas `NULL` por defecto) y los `CHECK` de columnas nuevas, y
**la app anterior sigue funcionando**: sus `INSERT`/`UPDATE` no mencionan las columnas nuevas y no
escriben `temperatura`. Gracias a haber **aplazado el `CHECK` de `source`** (Sección 2.3), la app
anterior tampoco puede chocar escribiendo texto libre en `source`. Aun así, la ventana entre backend
y frontend debe ser mínima: mientras dure, los usuarios no ven los campos nuevos (responsable,
ciudad, cargo, temperatura) y el backend los rechaza si vienen vacíos en `source` (que ahora es
obligatorio en alta).

**Rollback completo de BD (solo si lo pides):** se adjuntaría un
`docs/leads/rollback_138.sql` manual, no automático:

```sql
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perdida_detalle_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perdida_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperatura_check;
DROP INDEX IF EXISTS idx_leads_empresa_id, idx_leads_asignado, idx_leads_activos,
                      idx_leads_empresa_norm, idx_leads_phone_norm, idx_leads_email_norm;
ALTER TABLE leads DROP COLUMN IF EXISTS empresa_id, DROP COLUMN IF EXISTS deleted_at,
                  DROP COLUMN IF EXISTS motivo_perdida_detalle, DROP COLUMN IF EXISTS motivo_perdida,
                  DROP COLUMN IF EXISTS temperatura_puntos, DROP COLUMN IF EXISTS temperatura,
                  DROP COLUMN IF EXISTS cargo, DROP COLUMN IF EXISTS ciudad,
                  DROP COLUMN IF EXISTS source_detail;
```

(No hay `leads_source_check` que eliminar: ese `CHECK` quedó aplazado a una migración posterior,
ver Sección 2.3.)

Advertencia explícita: ese rollback **sí** destruye los datos nuevos (ciudad, cargo, motivo,
temperatura) y deja `source` ya normalizado (los textos libres originales siguen en `source_detail`,
que también se cae). Por eso es una decisión de último recurso y no forma parte del plan normal. No
se revierte nunca la normalización de `source` (no hay datos que restaurar; el original estaba en
texto libre y el codificado en `source_detail`).

**Compatibilidad hacia atrás con leads existentes:** la columna `source` acepta NULL y los códigos
del catálogo; `status` no cambia de valor; `score` y `converted_contact_id` no se tocan; ningún
otro módulo lee ni escribe `leads` (verificado en Fase 0).

---

## 9. Rama, migraciones y reporte de otros módulos

### 9.1 Estado de la rama `audit/loote-1-seguridad` (decisión 4)

```
$ git status
On branch audit/loote-1-seguridad
Your branch is up to date with 'origin/audit/loote-1-seguridad'.

Changes not staged for commit:
	modified:   backend/migrations/017_optimization_indexes.sql
	modified:   backend/migrations/020_clerk_user_id_nullable.sql
	modified:   backend/migrations/048_locativo_module.sql
	modified:   backend/migrations/049_activity_log.sql
	modified:   backend/migrations/067_roles_dinamicos.sql
	modified:   backend/migrations/088_add_mime_type_documentos.sql
	modified:   backend/migrations/126_familias_consecutivo_automatico.sql
	modified:   backend/migrations/130_remision_dias_fijo_horometros.sql
	modified:   backend/src/modules/informes/informes.controller.js
	modified:   backend/src/modules/informes/informes.repository.js
	modified:   backend/src/services/backupService.js
	modified:   frontend/src/pages/Informes/InformesGestionHumanaPage.jsx

Untracked files:
	analisis-productividad-gestion-humana.md
	backend/seeds/                      (leads_fase1_prueba.sql, Fase 1)
	backend/src/modules/informes/gestionHumana.test.js
	docs/
```

```
$ git diff --stat
 backend/migrations/017_optimization_indexes.sql             |   2 +-
 backend/migrations/020_clerk_user_id_nullable.sql           |  13 ++-
 backend/migrations/048_locativo_module.sql                  |   2 +-
 backend/migrations/049_activity_log.sql                     |   2 +-
 backend/migrations/067_roles_dinamicos.sql                  |   4 --
 backend/migrations/088_add_mime_type_documentos.sql         |  71 +++++++++++--
 backend/migrations/126_familias_consecutivo_automatico.sql  |  10 +-
 backend/migrations/130_remision_dias_fijo_horometros.sql    |  36 +++++-
 backend/src/modules/informes/informes.controller.js         |   6 +-
 backend/src/modules/informes/informes.repository.js         | 218 ++++++++++++++++-
 backend/src/services/backupService.js                       | 121 +++++++++-
 frontend/src/pages/Informes/InformesGestionHumanaPage.jsx   | 182 +++++++++--------
 12 files changed, 537 insertions(+), 130 deletions(-)
```

**Corrección importante sobre mi primer vistazo:** los 8 ficheros de migración **no** son retoques
de fin de línea; son cambios de contenido sustantivos. Al leer los diffs:

| Migración | Qué cambia en el árbol de trabajo |
|---|---|
| `067_roles_dinamicos.sql` | **Elimina marcadores de conflicto de merge sin resolver** (`<<<<<<< HEAD`, `=======`, `>>>>>>> f1c4b09`) que siguen **commiteados en `HEAD`** |
| `088_add_mime_type_documentos.sql` | Convierte un `ALTER TABLE documentos` (que fallaría: la tabla nunca se creó) en `CREATE TABLE IF NOT EXISTS documentos` + `tipos_documento` |
| `130_remision_dias_fijo_horometros.sql` | Mismo patrón: pasa de `ADD COLUMN` a `CREATE TABLE IF NOT EXISTS remision_dias_fijo` |
| `020_clerk_user_id_nullable.sql` | Envuelve el `ALTER` en un `DO $$` que comprueba si `clerk_user_id` existe (ya no está) |
| `126_familias_consecutivo_automatico.sql` | Hace idempotente el `INSERT` en `ubicaciones_bodega` y añade `bodega`/`estante` |
| `017_optimization_indexes.sql` | Cambia el índice `idx_users_rol_id ON users(rol_id)` por `idx_users_role ON users(role)` |
| `048_locativo_module.sql` | Elimina la FK `documento_adjunto_id REFERENCES documentos(id)` (tabla no existía) |
| `049_activity_log.sql` | `CONCAT_WS(u.nombre, u.apellido)` → `u.full_name` |

⚠️ **Hallazgo para tu decisión (no lo toco):** la versión **commiteada** de
`067_roles_dinamicos.sql` contiene marcadores de conflicto de merge; un runner que corriera desde
`HEAD` fallaría con error de sintaxis en esa migración. Tu árbol de trabajo ya lo tiene corregido,
pero **está sin confirmar**. Mismo criterio para 088/130/048/020: son parches de robustez sobre
migraciones ya registradas en `_migrations` (el runner no las vuelve a ejecutar, así que su efecto
real es solo sobre entornos nuevos). Lo dejo documentado; tú decides qué hacer con ellos.

**¿Esta rama ya corrige el RBAC de backend en Leads? NO.**
Ni en Leads ni en ningún módulo: `git diff main --stat` no toca `leads.routes.js` ni
`middleware/auth.js`, y `grep verificarPermiso` sigue devolviendo solo `contabilidad`, `facturacion`
y un endpoint suelto de `inventory/catalog`. El grueso del diff sin confirmar pertenece al bloque de
Informes/Gestión Humana (`informes.repository.js` +218, `backupService.js` +121,
`InformesGestionHumanaPage.jsx` 182 líneas, más el análisis y el test sin rastrear) →
**no duplica trabajo con la Fase 1**.

Tus cambios sin confirmar quedan intactos y sin tocar. `feature/leads-fase1` se creará **desde `main`**
y arrastrará esos cambios solo si decides mergearlos tú en `main` antes.

### 9.2 Migraciones (documentar, no tocar)

| Hallazgo (Fase 0) | Acción |
|---|---|
| Dos migraciones comparten número: `076` (dos archivos distintos) | Documentado. No se renombra nada: el runner usa solo el nombre, así que funciona igual. |
| Dos migraciones comparten número: `129` (dos archivos distintos) | Ídem. |
| `_migrations` tiene una fila sin fichero: `068_servicio_fijo.sql` | Documentado. El runner ya no la valida; no se borra. |
| 139 archivos = 139 en `MIGRATION_FILES` = 140 filas | Con la 138: 140 = 140 = 141. |

### 9.3 Reporte de RBAC en otros módulos (ampliación A+, **sin corregir**)

De **51 ficheros de rutas** del backend, solo **3** aplican `verificarPermiso`:

| Situación | Módulos |
|---|---|
| ✅ RBAC completo | `contabilidad`, `facturacion` |
| ⚠️ RBAC parcial (1 endpoint de muchos) | `inventory/catalog` (`PATCH /:id/stock`) |
| 🔒 `soloAdmin` en todos sus endpoints | `admin`, `roles`, `admin/backups` |
| 🔒 `authorize()` solo en algunos endpoints | `dashboard` (`authorize('gerencia')` en todos), `companies` (solo `DELETE`), `opportunities` (solo `DELETE`), `mantenimiento` (5 endpoints de cortes), `informes` (1 endpoint), `hojaVida` (`authorize('*')` = cualquiera autenticado, no protege nada) |
| ❌ **Solo autenticación, sin RBAC** (40 ficheros) | `leads` (objeto de esta fase), `companies` (resto), `contacts`, `pipeline`, `opportunities` (resto), `tasks`, `campaigns`, `support`, `employees`, `equipos`, `mantenimiento-programados`, `proveedores`, `compras`, `documentos`, `inventory` (+ `ubicaciones`, `movements`), `catalogo_servicios`, `servicios`, `servicios_negados`, `turnos`, `certificados`, `salud-ocupacional`, `empleados-llamados`, `quotes`, `quotes_servicios`, `supplier_quotes`, `budget`, `informes` (resto), `reports`, `horas_extras`, `centros_costos`, `email-marketing`, `busqueda-global`, `locativo`, `prompt-specs`, `resetPassword` |

**No se corrige ninguno.** La recomendación para una fase posterior: empezar por `contacts`,
`companies`, `pipeline` y `tasks` (datos comerciales sensibles con el mismo patrón que Leads), y
corregir `hojaVida` (donde `authorize('*')` da sensación falsa de protección).

### 9.4 Rama `fix/migraciones-conflicto-067` (creada, pendiente de tu revisión)

Creada **desde `audit/loote-1-seguridad`** y con **8 commits separados**, uno por fichero, empezando
por el conflicto de merge. No se ha tocado ninguna rama existente y tu bloque de Informes/backup sigue
sin confirmar en el árbol de trabajo.

| Commit | Fichero | Qué hace |
|---|---|---|
| `ff839ba` | `067_roles_dinamicos.sql` | Elimina los marcadores `<<<<<<< HEAD` / `=======` / `>>>>>>> f1c4b09` que estaban **commiteados en HEAD** (error de sintaxis 42601 en cualquier base nueva) |
| `fef36d4` | `017_optimization_indexes.sql` | ⚠️ Cambia `idx_users_rol_id ON users(rol_id)` por `idx_users_role ON users(role)` — **ver pregunta abierta 12.1** |
| `2f363ff` | `020_clerk_user_id_nullable.sql` | Envuelve el `ALTER` en un `DO $$` que comprueba si `clerk_user_id` existe |
| `b2db184` | `048_locativo_module.sql` | Quita la FK `documento_adjunto_id REFERENCES documentos(id)`; `documentos` se crea recién en 088 |
| `0f28e4b` | `049_activity_log.sql` | `CONCAT_WS(u.nombre, u.apellido)` → `u.full_name` |
| `6b2184f` | `088_add_mime_type_documentos.sql` | Crea `tipos_documento` (+ catálogo sembrado) y `documentos` con las columnas mime y 3 índices |
| `beae7b8` | `126_familias_consecutivo_automatico.sql` | Hace idempotente el `INSERT` en `ubicaciones_bodega` y añade `bodega`/`estante` |
| `e893c9f` | `130_remision_dias_fijo_horometros.sql` | Crea `remision_dias_fijo` con sus 18 columnas (incluidos los horómetros) |

**Verificación hecha antes de commitear** (contra la copia local):
- Las 8 migraciones **ya están aplicadas** en `_migrations` (140 filas) → los cambios **solo afectan
  a bases nuevas**; el runner no las vuelve a ejecutar.
- `users` tiene **tanto** `rol_id` como `role`, y **tanto** `nombre`/`apellido` como `full_name` →
  los cambios de 017 y 049 no rompen por columna inexistente.
- `ubicaciones_bodega` tiene `codigo_ubicacion`, `bodega` y `estante` → el 126 es coherente.
- `documentos` y `remision_dias_fijo` locales coinciden **exactamente** con las definiciones nuevas
  del 088 y del 130 → son las tablas reales que la app usa.

**Pendiente (tu revisión):** confirmas y lo llevo a `main`; con `017` decidido antes. **Solo después**
se crea `feature/leads-fase1` desde `main`.

---

## 10. Lista exacta de archivos

### 10.1 A crear

| Archivo | Módulo |
|---|---|
| `backend/migrations/138_leads_mejoras_fase1.sql` | Leads |
| `backend/src/modules/leads/leads.schemas.js` | Leads |
| `backend/src/modules/leads/leads.normalizacion.js` | Leads |
| `backend/src/modules/leads/leads.temperatura.js` | Leads |
| `backend/src/modules/leads/__tests__/leads.temperatura.test.js` | Leads |
| `backend/src/modules/leads/__tests__/leads.normalizacion.test.js` | Leads |
| `backend/src/modules/leads/__tests__/leads.schemas.test.js` | Leads |
| `backend/src/modules/leads/__tests__/leads.api.test.js` | Leads |
| `frontend/src/constants/leads.js` | Leads |
| `frontend/src/components/Leads/AvisoDuplicados.jsx` | Leads |
| `frontend/src/components/Leads/ModalMotivoPerdida.jsx` | Leads |
| `frontend/src/components/Leads/BuscadorEmpresa.jsx` | Leads |
| `frontend/src/components/Leads/leads.css` | Leads |
| `backend/seeds/leads_fase1_prueba.sql` | **ya creado y ejecutado en local** |

### 10.2 A modificar (dentro del módulo Leads)

| Archivo | Cambio |
|---|---|
| `backend/src/modules/leads/leads.routes.js` | RBAC + `validate` + 2 rutas nuevas |
| `backend/src/modules/leads/leads.controller.js` | validar, temperatura, motivo, borrado lógico, `duplicados`, `asignables` |
| `backend/src/modules/leads/leads.repository.js` | columnas nuevas, `deleted_at`, duplicados, conversión transaccional |
| `frontend/src/components/Leads/LeadForm.jsx` | dos niveles, duplicados, fuente/responsable/ciudad/cargo, modal de motivo |
| `frontend/src/pages/Leads/LeadsPage.jsx` | pastilla de temperatura, filtro "Asignado a", etiquetas |

### 10.3 A modificar — **fuera del módulo (te lo informo y requiere tu gate)**

| Archivo | Motivo | Riesgo |
|---|---|---|
| `backend/migrations/runner.js` | Registrar `138` en `MIGRATION_FILES` | Muy bajo: una línea obligatoria por reglas de migración |
| `backend/src/middleware/audit.middleware.js` | Añadir `/api/v1/leads/duplicados` a `EXCLUDED_PATHS` para que la auditoría no guarde el correo/teléfono de una simple comprobación | Bajo: solo afecta a esa ruta; `MODULE_MAP` y el resto del middleware quedan igual. **Aprobado (decisión 5)**: se muestra el diff exacto en el canal antes de aplicarlo |

### 10.4 No se tocan (decisión explícita)

`rateLimiter.js` (se reutiliza `searchLimiter`), `index.css` (se usa `leads.css`),
`companies.*` y `contacts.*` (solo lectura), `email-marketing.*`, `campaigns`, `tareas`, `dashboard`,
`auth.js`, y cualquier migración existente.

---

## 11. Impacto de la ampliación de alcance

Esfuerzo en días-desarrollo (incluye pruebas), sobre la estimación base de la Fase 1.

| Punto nuevo | Esfuerzo | Riesgo | Notas |
|---|---|---|---|
| RBAC en backend (6 endpoints + 2 nuevos) | 0,5 | Medio-bajo | Verificado: 0 usuarios activos pierden acceso legítimo. El riesgo residual es el cache de permisos (5 min) y roles que se creen después sin fila en `roles_permisos` |
| Validación de entrada por endpoint (crear/editar/convertir + listado + duplicados) | 1,0 | Bajo | 4 esquemas `zod`, sanitización de texto y suite de 3 ficheros de tests |
| Borrado lógico | 0,5 | Bajo | Migración (columna + 2 índices), filtros en 4 consultas del repositorio, 4 tests. Ningún otro módulo lee `leads` |
| Migración 138 + registro en `runner.js` | 0,5 | Medio | Incluye normalización de `source`, `CHECK`s de columnas nuevas, índices y mapeo de temperatura legada. El `CHECK` de `source` queda **aplazado** a una migración posterior (Sección 2.3) |
| `empresa_id` (decisión 3) | 0,2 | Bajo | Columna + índice + validación en backend + relleno desde el buscador del ítem H |
| Exclusión de `duplicados` de auditoría | 0,1 | Bajo | 1 línea en archivo compartido (Sección 10.3), diff mostrado antes |
| **Total ampliación** | **≈ 2,8 días** | | |

Fuera de días-desarrollo (paso de despliegue, Sección 8): respaldo `pg_dump -t leads` + copia fuera
del servidor antes de aplicar la 138.

No incluido (por decisión tuya): corregir RBAC en otros módulos, job diario de recálculo de
temperatura, endpoint de restauración de archivados, consentimiento Habeas Data.

---

## 12. Preguntas abiertas — cerradas el 2026-10-19

Las 8 preguntas originales quedaron decididas (resumen en Sección 0.1):

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Detalle de fuente A/B | **B**, la que siempre conserva el texto original |
| 2 | Fuente vacía | `NULL` en legados; **obligatoria en altas**, validada en backend |
| 3 | `empresa_id` | **Sí**, FK opcional ligada al ítem H, conservando el texto |
| 4 | `score` | Congelado como histórico; se edita y muestra la temperatura |
| 5 | Auditoría de duplicados | **Aprobado** excluirlo, con diff exacto mostrado antes |
| 6 | Frescura sin job | Aceptable; pendiente de la Fase 2 del módulo |
| 7 | Contacto duplicado en conversión | Avisar y ofrecer vincular; nunca duplicar en silencio ni bloquear |
| 8 | Umbrales 71/31/30 | Punto de partida en una sola constante; revisar con datos reales |

### 12.1 Abiertas tras incorporar las decisiones

1. **Índice de la migración 017** (bloque `fix/migraciones-conflicto-067`, Sección 9.4): el parche
   cambia `idx_users_rol_id ON users(rol_id)` por `idx_users_role ON users(role)`. `auth.js` hace el
   JOIN de RBAC sobre `u.rol_id`, así que el índice nuevo no beneficia a los permisos dinámicos.
   **¿Revertir 017, mantenerlo, o indexar las dos columnas?**
2. **¿Commitear el seed de pruebas a `main` con su guarda anti-producción, o dejarlo fuera del
   repo?** La guarda ya está puesta y verificada (se niega a correr si el nombre de la base no
   contiene prueba/test/dev/local/sandbox/tmp). *(Sección 1)*
3. **¿Confirmas el respaldo `pg_dump -t leads` previo al despliegue?** (Sección 8) Necesito saber
   quién lo ejecuta y dónde se guarda la copia fuera del servidor.
4. **¿Cuándo añadimos el `CHECK` de `source`?** Propongo esperar a que backend y frontend lleven
   estables en producción y no haya planes de rollback; entonces una migración aparte (p. ej. 140).

---

## 13. Fuera de alcance de esta fase (recordatorio)

Kanban, línea de tiempo, "Necesidad", conversión a cotización, informes de embudo, captura
automática, consentimiento Habeas Data (Fase 2 del módulo), restauración de archivados desde la
interfaz, y cualquier corrección de RBAC en módulos ajenos.

**Pendientes explícitos para la Fase 2 del módulo Leads:**
- Job diario de recálculo de temperatura (decisión 6).
- Revisión de los umbrales con datos reales tras unas semanas (decisión 8).
- Añadir el `CHECK` de `source` cuando el despliegue esté estabilizado (12.1).
- Consentimiento Habeas Data en el alta de leads (ítem H completo).

---

**Estado final de esta fase.** La Fase 1 **no** ha escrito código de producción de Leads ni ha
aplicado migraciones. Lo que sí se ha tocado, y queda fuera del alcance del módulo:
1. `backend/seeds/leads_fase1_prueba.sql` — creado y ejecutado solo en la copia local, ahora con
   guarda anti-producción (Sección 1).
2. Rama `fix/migraciones-conflicto-067` — 8 commits de parches de migración que ya estaban en tu
   árbol de trabajo, **pendientes de tu revisión** (Sección 9.4). No se ha tocado ninguna rama
   existente ni se ha llevado nada a `main`.
