# Diagnóstico: Consecutivo de Ubicación por Familia en Importación Excel (Catálogo/Items)

**Fecha:** 22 de Octubre de 2026  
**Módulo:** Catálogo / Items (`inventory` / `catalog`)  
**Fase:** FASE 0 — RECONOCIMIENTO (Solo lectura)  
**Estado:** Completado — En espera de aprobación GATE 0

---

## 1. Resumen Ejecutivo y Causa Raíz

### Hallazgo Principal
El problema no es una falla fortuita de datos en "Sistema Motor", sino una **discrepancia estructural entre la especificación de negocio y la implementación del backend**:

1. **La regla de negocio esperada:** Cada familia debe tener su propia secuencia de ubicaciones físicas empezando en `001` (`001`, `002`, `003`... para Eléctrico; `001`, `002`, `003`... para Motor).
2. **Lo que la Migración 126 implementó:** Creó **una sola ubicación genérica por categoría** basada en un consecutivo global de categorías:
   - `001` para "Sistema Eléctrico" (forzado primero en el `ORDER BY` de la migración 126).
   - `002` para "Lubricantes y Aceites".
   - `003` para "Dirección y Frenos".
   - `004` para "Filtros".
   - `005` para "Filtros e Insumos".
   - `006` para "Sistema Motor".
   - Y así sucesivamente hasta la categoría 31.
   Dicha ubicación única fue asignada en `catalogo_categorias.ubicacion_default_id`.
3. **Lo que hace el código de importación (`importItems`):**
   - En `backend/src/modules/inventory/catalog.repository.js` (L713):
     ```javascript
     ubicacion_id: null // El método create calculará el consecutivo por familia automáticamente
     ```
   - Quien escribió `importItems` asumió que `create()` generaba el consecutivo. Sin embargo, en `create()` (L383-388):
     ```javascript
     let ubicacionFinal = toUuid(ubicacion_id);
     if (!ubicacionFinal && toUuid(categoria_id)) {
       const famRes = await query('SELECT ubicacion_default_id FROM catalogo_categorias WHERE id = $1', [toUuid(categoria_id)]);
       ubicacionFinal = famRes.rows[0]?.ubicacion_default_id || null;
     }
     ```
   - `create()` **NO calcula ningún consecutivo**; simplemente asigna el `ubicacion_default_id` de la familia.
4. **Por qué "Sistema Eléctrico" tiene 001..137:**
   En la base de datos existen 137 registros individuales creados en `ubicaciones_bodega` con descripción `"Posición 001 - Sistema Eléctrico"` hasta `"Posición 137 - Sistema Eléctrico"`. Estos fueron creados durante una carga previa específica. Además, existe una función `getSiguienteConsecutivoUbicacion(categoriaId)` en `CatalogRepository:317` que calcula `MAX(codigo_ubicacion) + 1`, pero **nunca fue conectada al flujo de inserción de productos (`create` ni `importItems`)**.
5. **Por qué "Sistema Motor" quedó todo en 006:**
   Al importarse "Sistema Motor", `createData.ubicacion_id` llegó en `null`, `create()` consultó `ubicacion_default_id` de la categoría "Sistema Motor", el cual es `2bae9448-dd33-4512-87b1-a1730c715919` (cuyo `codigo_ubicacion` es `006`, "Estantería Motor"). Por lo tanto, los 102 ítems de Sistema Motor recibieron `'006'` y ninguno incrementó.

---

## 2. Informe Agente A — Flujo de Importación y Código

### 2.1. Localización de Componentes
- **Ruta Backend:** `POST /api/catalogo/import`  
  [catalog.routes.js:46](file:///c:/Users/user/Documents/Proyectos/crm01/backend/src/modules/inventory/catalog.routes.js#L46)
- **Middleware:** `authenticate`, `uploadLimiter`, `excelUpload` (Multer memoryStorage, máx 10 MB, solo `.xlsx` y `.xls`).
- **Controlador:** `importExcel`  
  [catalog.controller.js:221-259](file:///c:/Users/user/Documents/Proyectos/crm01/backend/src/modules/inventory/catalog.controller.js#L221-L259)
- **Servicio/Repositorio:** `CatalogRepository.importItems(rows, userId)`  
  [catalog.repository.js:531-734](file:///c:/Users/user/Documents/Proyectos/crm01/backend/src/modules/inventory/catalog.repository.js#L531-L734)

### 2.2. Paso a Paso de la Asignación de Ubicación
1. El usuario sube el archivo Excel vía `POST /api/catalogo/import`.
2. El controller lee el buffer en memoria usando `xlsx.read` y obtiene las filas de la hoja `Items` o `Catalogo`.
3. Se invoca `repo.importItems(rows, userId)`.
4. Para cada fila del Excel:
   - Se resuelve la categoría por nombre o slug contra `catalogo_categorias`.
   - Se valida nombre/referencia.
   - En la línea 713 se construye el objeto `createData`:
     ```javascript
     ubicacion_id: null // El método create calculará el consecutivo por familia automáticamente
     ```
   - Se llama a `this.create(createData, userId)`.
5. Dentro de `this.create(data, userId)` (L383-388):
   - Al ser `ubicacion_id === null`, ejecuta:
     ```javascript
     SELECT ubicacion_default_id FROM catalogo_categorias WHERE id = $1
     ```
   - Asigna directamente ese UUID estático a la columna `ubicacion_id` del nuevo registro en `inventario`.
6. **Respuestas a las preguntas de auditoría:**
   - **¿Viene de la plantilla?** NO. La plantilla no incluye la columna Ubicación y el parser no la lee.
   - **¿Viene de `ubicacion_default_id` de la familia?** SÍ, 100% proviene de esta columna estática.
   - **¿Usa un `MAX()` o `COUNT()`?** NO.
   - **¿Usa una función SQL?** NO.
   - **¿Se calcula una vez por lote o una vez por fila?** Se ejecuta una consulta `SELECT ubicacion_default_id` por fila, pero retorna siempre el mismo valor fijo configurado en la categoría.
   - **¿Se lee dentro o fuera de la transacción?** Fuera. No existe transacción (`BEGIN...COMMIT`) que envuelva el lote de importación.

### 2.3. Comparación con Creación Individual (CatalogController)
- En [CatalogFormPage.jsx:142-144](file:///c:/Users/user/Documents/Proyectos/crm01/frontend/src/pages/Inventory/CatalogFormPage.jsx#L142-L144):
  ```javascript
  if (!isEdit && formData.tipo === 'PRODUCTO') {
    payload.ubicacion_id = null;
  }
  ```
  Al crear un producto individualmente en la UI, el frontend fuerza `ubicacion_id = null` antes de enviarlo a `POST /api/catalogo/`.
- El backend `createItem` llama a `repo.create()`, el cual ejecuta exactamente la misma asignación de `ubicacion_default_id`.
- Por tanto, la creación manual individual de un ítem tiene **la misma falla** que la importación: no genera un nuevo consecutivo (001, 002...), sino que le asigna la ubicación genérica fija de la familia.
- **Diferencia con Código Interno:**
  Para el `codigo_interno`, `create()` invoca `_generarCodigo(tipo, categoriaId)` que llama a la función SQL atómica `generar_codigo_por_familia(p_categoria_id)` (creada en migración 129), la cual bloquea la categoría con `FOR UPDATE`, incrementa `ultimo_codigo_int` y genera números consecutivos (ej. 1000..1137, 2000..2006). Para la ubicación, esa lógica nunca se implementó en la base de datos ni en el repositorio.

### 2.4. Plantilla Excel Descargable
- Generada en el frontend por `CatalogImportModal.jsx:25-44`.
- Columnas: `Código Interno`, `Nombre Comercial`, `Referencia`, `Tipo`, `Familia`, `Unidad de Medida`, `Marca`, `Costo Unitario`, `Precio Venta`, `Stock Actual`, `Stock Mínimo`, `Precio Servicio`, `Unidad de Cobro`, `Aplica IVA`, `Porcentaje IVA`, `Clasificación Técnica`, `Referencias Cruzadas`, `Equipos Compatibles`.
- **No existe columna de Ubicación**. No se solicita al usuario, por lo que el sistema debe generarla automáticamente.

---

## 3. Informe Agente B — Base de Datos y Esquema Real

### 3.1. DDL Real de las Tablas Involucradas

#### `catalogo_categorias`
| Columna | Tipo | Nulo | Default | Origen / Migración |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | 013 |
| `nombre` | `varchar` | NO | - | 013 |
| `slug` | `varchar` | NO | - | 013 |
| `ubicacion_default_id` | `uuid` | SÍ | `NULL` | **Migración 125** (FK -> `ubicaciones_bodega.id`) |
| `codigo_interno_base` | `integer` | SÍ | `NULL` | **Migración 129** |
| `ultimo_codigo_int` | `integer` | SÍ | `0` | **Migración 129** |

#### `ubicaciones_bodega`
| Columna | Tipo | Nulo | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Clave primaria |
| `codigo_ubicacion` | `varchar` | SÍ | Código visible (ej. `'001'`, `'006'`, `'MOT-N3-L-01'`) |
| `descripcion` | `varchar` | SÍ | Descripción (ej. `'Estantería Motor'`, `'Posición 001 - Sistema Eléctrico'`) |
| `bodega` | `varchar` | SÍ | `'Principal'` |
| `zona`, `estante`, `nivel`, `posicion` | `varchar` | SÍ | `NULL` para ubicaciones genéricas / estanterías de familia |
| `activo` | `boolean` | SÍ | `true` |

- **Índice único actual (Migración 127):**
  ```sql
  CREATE UNIQUE INDEX idx_ubicacion_bodega_unica ON ubicaciones_bodega
    (bodega, COALESCE(zona,'X'), COALESCE(estante,'X'), COALESCE(nivel,'X'), COALESCE(posicion,'X'))
    WHERE zona IS NOT NULL OR estante IS NOT NULL OR nivel IS NOT NULL OR posicion IS NOT NULL;
  ```
  > [!NOTE]
  > El índice es un índice parcial que solo aplica si al menos uno de los campos jerárquicos no es nulo. Para ubicaciones genéricas (donde zona, estante, nivel y posición son NULL), **no existe restricción de unicidad**. Tampoco existe índice UNIQUE sobre `codigo_ubicacion`.

#### `inventario`
| Columna | Tipo | Relación |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `codigo_interno` | `varchar` | Código de producto (1000, 2000...) |
| `categoria_id` | `uuid` | FK -> `catalogo_categorias.id` |
| `ubicacion_id` | `uuid` | FK -> `ubicaciones_bodega.id` |

### 3.2. Comparativa: "Sistema Eléctrico" vs. "Sistema Motor"

| Parámetro | Sistema Eléctrico | Sistema Motor |
| :--- | :--- | :--- |
| **Categoría ID** | `89a5be4c-939e-431a-ac89-a67b128b3cf0` | `26432c9e-7208-48b7-a366-47faf09b6339` |
| `codigo_interno_base` | `1000` | `2000` |
| `ultimo_codigo_int` | `137` | `0` |
| `ubicacion_default_id` | `592d47ec-63d9-4c01-8eae-e2a82b413080` | `2bae9448-dd33-4512-87b1-a1730c715919` |
| Ubicación default (`codigo_ubicacion`) | `'001'` | `'006'` |
| Descripción ubicación default | `'Estantería Sistema Eléctrico'` | `'Estantería Motor'` |
| Total productos en `inventario` | **137** | **102** |
| Rango de `codigo_interno` | `1000` a `1136` | `2000` a `2721` |
| Ubicaciones asignadas en `inventario` | **137 ubicaciones distintas (`001` .. `137`)** | **1 sola ubicación (`006` en los 102 ítems)** |
| Filas en `ubicaciones_bodega` | 137 filas `"Posición 001 - Sistema Eléctrico"` .. `"Posición 137 - ..."` | 1 sola fila `"Estantería Motor"` (`006`) |

### 3.3. Estado de Migraciones en `_migrations`
Se verificó la tabla `_migrations` en la base de datos real:
- **125 (`125_categoria_ubicacion_default.sql`):** Aplicada (id 130, 2026-09-08).
- **126 (`126_familias_consecutivo_automatico.sql`):** Aplicada (id 131, 2026-09-09).
- **127 (`127_fix_indice_ubicacion_bodega.sql`):** Aplicada (id 132, 2026-09-09).
- **128 (`128_catalogo_completo_timestamps.sql`):** Aplicada (id 133, 2026-09-11).
- **129 (`129_busqueda_global_indexes.sql`):** Aplicada (id 134, 2026-09-11).
- **129 (`129_codigo_interno_por_familia.sql`):** Aplicada (id 137, 2026-09-16).
- **Última migración registrada:** `144_notificaciones_genericas.sql` (id 150).
- La siguiente migración libre para el fix es la **`145`**.

### 3.4. Censo Completo de Familias en la BD
El censo de la tabla `inventario` (tipo `PRODUCTO`) arrojó un total de **242 productos**:
1. **Sistema Eléctrico:** 137 ítems (consecutivo `001` a `137`).
2. **Sistema Motor:** 102 ítems (todos asignados a `006`).
3. **Cocina y Cafetería:** 1 ítem (asignado a `021`, su `ubicacion_default_id`).
4. **Sistema Hidráulico:** 1 ítem (asignado a `EST-N1-FRENTE-1`, bodega física estructurada).
5. **Sin Categoría:** 1 ítem (`Licencia Sistema Operativo Windows`, sin ubicación).

**Conclusión:** Todas las familias excepto "Sistema Eléctrico" sufren del mismo comportamiento si se importan o crean productos: se les asigna el código de estantería de la categoría (ej. 006, 021, etc.) de forma fija y repetida.

---

## 4. Hipótesis Ordenadas por Probabilidad

### Hipótesis 1 (Confirmada al 100%): Falta de lógica de autoincremento y generación de registros en `ubicaciones_bodega`
- **Evidencia:** `catalog.repository.js:713` manda `ubicacion_id = null`, y `create()` en L387 asigna directamente `catalogo_categorias.ubicacion_default_id`.
- La migración 126 solo creó una ubicación por familia en `ubicaciones_bodega` (001 a 031).
- Cuando "Sistema Motor" se importó, tomó su ubicación por defecto (`006`), repitiéndola en todos los 102 ítems.
- **Probabilidad:** **Certeza absoluta (100%)**.

### Hipótesis 2: Inconsistencia entre migraciones previas
- La migración 126 asumió erróneamente en su momento:
  > *"Cada familia tiene un consecutivo de estanteria automatico (001, 002, 003, ...) y todos los productos de la misma familia comparten ese consecutivo."*
- Mientras que la regla de negocio real exigida por la empresa es:
  > *"Dentro de cada familia, cada producto tiene un consecutivo automático que empieza en 001 (001, 002, 003...).*
- Esta confusión conceptual originó que se crearan las categorías con `ubicacion_default_id` fijos (001, 002... 006) en lugar de un contador o secuencia por producto.

---

## 5. Módulos y Relaciones Externas Detectadas (Solo Lectura)
Al verificar dependencias de los 102 ítems de "Sistema Motor", se encontró:
- `movimientos_inventario`: 0 registros.
- `compras_registro`: 0 registros.
- `quote_items`: 0 registros.
- `ot_repuestos_insumos`: **1 registro vinculado** (OT repuesto para el ítem `CARBURADOR NISSAN K21-K25`, `codigo_interno: '2655'`).
  - Vinculado por `item_inventario_id = inventario.id` (UUID del ítem).
  - No vincula `ubicacion_id` directamente.
  - **Implicación crítica:** No se deben borrar ni recrear los ítems de `inventario`, únicamente actualizar su `ubicacion_id`.

---

## 6. Solicitud de Aprobación — GATE 0

Hemos completado la FASE 0 de reconocimiento en modo estrictamente de solo lectura.

¿Apruebas el diagnóstico de la **FASE 0** para avanzar a la **FASE 1 (Diseño de la Solución)**?
