# Diseño de la Solución: Consecutivo de Ubicación por Familia en Importación y Catálogo

**Módulo:** Catálogo / Items (`inventory` / `catalog`)  
**Fase:** FASE 1 — DISEÑO DE LA SOLUCIÓN (Solo lectura)  
**Fecha:** 22 de Octubre de 2026  
**Documento previo:** [`diagnostico-ubicacion-importacion.md`](file:///c:/Users/user/Documents/Proyectos/crm01/diagnostico-ubicacion-importacion.md)

---

## 1. Semántica Exacta de la Regla de Negocio

### 1.1. Especificación del Consecutivo
- **Formato:** Código numérico de al menos 3 dígitos rellenado con ceros a la izquierda (`001`, `002`, ..., `999`). Si supera `999`, crece dinámicamente a 4 dígitos o más (`1000`, `1001`...) sin truncarse.
- **Independencia por familia:** Cada categoría (`catalogo_categorias`) mantiene su propio contador atómico (`ultimo_consecutivo_ubicacion`), garantizando que cada familia tenga su propia secuencia independiente que comienza en `001`.
- **Representación física en `ubicaciones_bodega`:**
  - `bodega`: `'Principal'`
  - `codigo_ubicacion`: `'001'`, `'002'`, etc.
  - `descripcion`: `'Posición ' || codigo || ' - ' || categoria_nombre` (ej. `'Posición 001 - Sistema Motor'`).
  - `zona`, `estante`, `nivel`, `posicion`: `NULL` (ubicación genérica/de estantería).
  - `activo`: `true`.

### 1.2. Preguntas Abiertas sobre Casos de Borde (con Recomendación)

A continuación se presentan las decisiones de diseño para los casos de borde para confirmación del usuario:

| Caso de Borde | Comportamiento Propuesto | Rationale / Recomendación |
| :--- | :--- | :--- |
| **a) Familia ya tiene ítems con ubicación** | El consecutivo continúa a partir de $M+1$, donde $M$ es el mayor número asignado. | **(Recomendado)** Garantiza continuidad sin sobreescribir ni duplicar posiciones físicas ya asignadas. |
| **b) El Excel trae ubicación explícita** | Si la columna de Ubicación se implementa o viene llena, se respeta la ubicación enviada y **no** se consume consecutivo. Si viene vacía (comportamiento actual de la plantilla oficial), se autogenera el consecutivo. | **(Recomendado)** Permite asignar ubicaciones fijas específicas cuando el usuario lo requiera, manteniendo la autogeneración como default. |
| **c) Se supera el número 999** | Pasa automáticamente a formato de 4 dígitos (`1000`, `1001`, etc.) usando `LPAD(n::text, GREATEST(3, LENGTH(n::text)), '0')`. | **(Recomendado)** Evita errores de overflow o códigos truncados y preserva la capacidad de ordenamiento alfabético y numérico. |
| **d) Un ítem se elimina de la familia** | **No se reutiliza el número**. El contador sigue siempre hacia adelante ($N+1$). | **(Recomendado)** Principio de inmutabilidad y trazabilidad física. Evita confusiones con etiquetas físicas ya impresas en bodega. |

---

## 2. Atomicidad y Concurrencia

Para garantizar que **dos importaciones o creaciones simultáneas nunca generen la misma ubicación**, la arquitectura sigue el patrón atómico validado de la migración 129 (`generar_codigo_por_familia`):

### 2.1. Columna de Control en `catalogo_categorias`
Se agrega la columna en `catalogo_categorias`:
```sql
ALTER TABLE catalogo_categorias
  ADD COLUMN IF NOT EXISTS ultimo_consecutivo_ubicacion INT DEFAULT 0;
```

### 2.2. Función Atómica en PostgreSQL: `generar_ubicacion_por_familia`
Se crea una función de base de datos ejecutada dentro de la transacción que utiliza `SELECT ... FOR UPDATE` para serializar la concurrencia a nivel de fila:

```sql
CREATE OR REPLACE FUNCTION generar_ubicacion_por_familia(p_categoria_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_num INT;
  v_cat_nom  TEXT;
  v_code     TEXT;
  v_ubi_id   UUID;
BEGIN
  -- 1. Bloquear la fila de la categoría para concurrencia atómica
  SELECT nombre, COALESCE(ultimo_consecutivo_ubicacion, 0) + 1
    INTO v_cat_nom, v_next_num
    FROM catalogo_categorias
   WHERE id = p_categoria_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría % no encontrada', p_categoria_id;
  END IF;

  -- 2. Incrementar el contador en la categoría
  UPDATE catalogo_categorias
     SET ultimo_consecutivo_ubicacion = v_next_num
   WHERE id = p_categoria_id;

  -- 3. Formatear el código (001, 002... 999, 1000...)
  IF v_next_num < 1000 THEN
    v_code := LPAD(v_next_num::TEXT, 3, '0');
  ELSE
    v_code := v_next_num::TEXT;
  END IF;

  -- 4. Crear la ubicación física en ubicaciones_bodega
  INSERT INTO ubicaciones_bodega (
    codigo_ubicacion,
    descripcion,
    activo,
    bodega
  ) VALUES (
    v_code,
    'Posición ' || v_code || ' - ' || v_cat_nom,
    TRUE,
    'Principal'
  )
  RETURNING id INTO v_ubi_id;

  RETURN v_ubi_id;
END;
$$;
```

### 2.3. Garantías de Concurrencia
- Al usar `FOR UPDATE` sobre la categoría específica, dos transacciones concurrentes que importen ítems para la misma familia se pondrán en cola de forma ordenada sin generar duplicados.
- Transacciones para familias distintas operan en paralelo sin bloquearse mutuamente.

---

## 3. Comportamiento Transaccional del Lote

### 3.1. Análisis de Modelos de Transaccionalidad
1. **Opción A — Transacción por Lote Completo (Todo o Nada):**
   - Si una sola fila del Excel es inválida (ej. error de tipo o datos obligatorios faltantes), se revierte todo (`ROLLBACK`).
   - *Ventaja:* Estado 100% limpio, el contador nunca se adelanta si el archivo tiene errores.
   - *Desventaja:* En un archivo de 200 filas, un error en la fila 199 obliga al usuario a corregir y volver a subir todo.
2. **Opción B — Tolerante a Fallos por Fila con Transacción Individual por Fila (Recomendada):**
   - Se valida la fila antes de solicitar el consecutivo. Si la fila falla en la validación, **no se invoca la función y no se quema el número**.
   - Solo se incrementa el consecutivo e inserta la ubicación cuando la fila ha pasado todas las validaciones y está lista para guardarse en `inventario`.
   - Cada inserción individual es atómica. Si una fila falla por error de base de datos, el rollback de esa fila particular no deja quemado el número ya que se ejecuta dentro del bloque seguro.
   - Al finalizar, el usuario recibe el reporte: "X creados, Y actualizados, Z errores con número de fila exacto", consistente con la UI actual.

---

## 4. Compatibilidad con el Índice Parcial (Migración 127) y Esquema

### 4.1. Análisis del Índice `idx_ubicacion_bodega_unica`
El índice actual (definido en migración 127) es:
```sql
CREATE UNIQUE INDEX idx_ubicacion_bodega_unica ON ubicaciones_bodega
  (bodega, COALESCE(zona,'X'), COALESCE(estante,'X'), COALESCE(nivel,'X'), COALESCE(posicion,'X'))
  WHERE zona IS NOT NULL OR estante IS NOT NULL OR nivel IS NOT NULL OR posicion IS NOT NULL;
```

- Las nuevas ubicaciones automáticas tienen `zona = NULL`, `estante = NULL`, `nivel = NULL`, `posicion = NULL`.
- Por tanto, la cláusula `WHERE` del índice no se cumple, lo que significa que **este índice ignora por completo estas ubicaciones**.
- No hay riesgo de colisión de unicidad entre posiciones de familias distintas que compartan el mismo `codigo_ubicacion` (ej. `'001'`).
- Además, `ubicaciones_bodega` no tiene ninguna restricción `UNIQUE (codigo_ubicacion)`.

---

## 5. Plan de Corrección de Datos Existentes (Sistema Motor)

### 5.1. Situación Actual
- Familia "Sistema Motor" (`id: 26432c9e-7208-48b7-a366-47faf09b6339`).
- 102 productos registrados en `inventario`, todos apuntando a `ubicacion_default_id = '2bae9448-dd33-4512-87b1-a1730c715919'` (código `'006'`).
- Un producto (`CARBURADOR NISSAN K21-K25`, código interno 2655) está vinculado a `ot_repuestos_insumos` por `item_inventario_id`.

### 5.2. Procedimiento de Corrección
1. **Idempotencia:** El script verifica el estado actual de los ítems. Si un ítem ya tiene una ubicación exclusiva `001..102` de Sistema Motor, no la altera.
2. **Criterio de ordenación:** Se ordenan los 102 productos por `created_at ASC, id ASC` para respetar rigurosamente el orden de llegada en la importación original.
3. **Paso a paso:**
   - Crear las 102 ubicaciones en `ubicaciones_bodega` con códigos `001` a `102` y descripciones `'Posición 001 - Sistema Motor'` .. `'Posición 102 - Sistema Motor'`.
   - Actualizar el campo `ubicacion_id` de cada uno de los 102 productos de inventario.
   - Actualizar `catalogo_categorias.ultimo_consecutivo_ubicacion = 102` para la categoría "Sistema Motor".
   - Inicializar `catalogo_categorias.ultimo_consecutivo_ubicacion = 137` para la categoría "Sistema Eléctrico".
   - Inicializar las demás categorías según su máximo existente o en `0`.
4. **Verificación de dependencias:**
   - No se alteran los IDs primarios (`inventario.id`), por lo que la relación en `ot_repuestos_insumos` se mantiene intacta.
   - En `movimientos_inventario` no hay registros para Sistema Motor.
5. **Protocolo de Seguridad:**
   - Primero se ejecuta en modo **Dry-run**, generando un archivo con el mapeo `codigo_interno | nombre | ubicacion_anterior | ubicacion_nueva`.
   - La ejecución real solo se aplica en la Fase 3 con confirmación del usuario.

---

## 6. Archivos a Modificar y Alcance

| Archivo | Tipo de Cambio | Pertenece a Módulo Externo |
| :--- | :--- | :--- |
| `backend/migrations/145_ubicacion_consecutivo_por_familia.sql` | **NUEVO** — Migración SQL que crea la columna, la función atómica y la inicialización de contadores. | NO (Catálogo/Inventario) |
| `backend/migrations/runner.js` | Modificación puntual: registrar migración `145` en `MIGRATION_FILES`. | NO (Runner común) |
| `backend/src/modules/inventory/catalog.repository.js` | Modificación en `create()` e `importItems()` para autogenerar la ubicación por familia cuando sea producto nuevo y `ubicacion_id` sea nulo. | NO (Catálogo/Inventario) |
| `frontend/src/pages/Inventory/CatalogFormPage.jsx` | Corrección menor en `handleSubmit`: permitir enviar `ubicacion_id` si el usuario seleccionó una explícita; si dejó default, enviar `null` para autogenerar consecutivo. | NO (Catálogo/Inventario) |

> [!IMPORTANT]
> **Ningún archivo pertenece a módulos externos.** Todo el cambio está contenido dentro del módulo de Catálogo/Inventario (`src/modules/inventory` y su formulario en `frontend/src/pages/Inventory`).

---

## 7. Solicitud de Aprobación — GATE 1

Se solicita al usuario:
1. Revisar y confirmar las respuestas a las preguntas de casos de borde (Sección 1.2).
2. Aprobar el diseño de la **FASE 1** para proceder a la **FASE 2 (Plan de Pruebas Previo)**.
