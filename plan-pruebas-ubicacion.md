# Plan de Pruebas Previo: Consecutivo de Ubicación por Familia en Catálogo

**Módulo:** Catálogo / Items (`inventory` / `catalog`)  
**Fase:** FASE 2 — PLAN DE PRUEBAS PREVIO (Solo lectura)  
**Fecha:** 22 de Octubre de 2026  
**Responsable:** Agente C (QA / Validación)  
**Documentos previos:**  
- [`diagnostico-ubicacion-importacion.md`](file:///c:/Users/user/Documents/Proyectos/crm01/diagnostico-ubicacion-importacion.md) (Fase 0)  
- [`diseno-ubicacion-importacion.md`](file:///c:/Users/user/Documents/Proyectos/crm01/diseno-ubicacion-importacion.md) (Fase 1)

---

## 1. Resumen y Objetivos de Calidad
Este plan define de forma exhaustiva los casos de prueba para validar la solución antes de su implementación en la Fase 3.
El objetivo es garantizar que:
1. Toda nueva familia o familia vacía asigne ubicaciones consecutivas `001`, `002`, `003`... sin excepción.
2. Toda familia con ítems existentes continúe la secuencia desde $M+1$.
3. Dos o más familias en el mismo lote Excel procesen sus consecutivos de forma completamente independiente.
4. Las importaciones concurrentes no produzcan duplicados de código de ubicación para la misma familia.
5. La creación manual individual desde `CatalogFormPage` mantenga perfecta paridad con el flujo de importación Excel.
6. Las funciones críticas del catálogo (descarga de plantilla, exportación a Excel, código interno por familia y búsqueda global) no sufran regresión.

---

## 2. Matriz de Casos de Prueba

### Caso 1: Importar Excel con $N$ ítems a una familia vacía
- **Objetivo:** Verificar que una familia sin productos previos arranque en `001` y asigne `001..N` secuencialmente.
- **Precondición:** Familia "Baterías" (o familia de prueba sin productos activos) con `ultimo_consecutivo_ubicacion = 0`.
- **Datos de Entrada (Excel con 3 ítems):**
  - Fila 1: `Batería 12V 100Ah`, Familia: `Baterías`
  - Fila 2: `Batería 24V 150Ah`, Familia: `Baterías`
  - Fila 3: `Terminal de Batería Plomo`, Familia: `Baterías`
- **Verificación:**
  ```sql
  SELECT i.codigo_interno, i.nombre_comercial, ub.codigo_ubicacion, ub.descripcion
  FROM inventario i
  JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
  JOIN catalogo_categorias c ON c.id = i.categoria_id
  WHERE c.slug = 'baterias'
  ORDER BY ub.codigo_ubicacion ASC;
  ```
- **Criterio de Aceptación:**
  - Ítems creados con ubicaciones `001`, `002`, `003`.
  - Descripciones en `ubicaciones_bodega`: `Posición 001 - Baterías`, `Posición 002 - Baterías`, `Posición 003 - Baterías`.
  - `catalogo_categorias.ultimo_consecutivo_ubicacion = 3`.

---

### Caso 2: Importar ítems a una familia que ya tiene $M$ ítems
- **Objetivo:** Verificar que si una categoría ya tiene $M$ ítems, el siguiente ítem reciba $M+1$.
- **Precondición:** Familia "Sistema Motor" tras la corrección tiene 102 ítems (`001` a `102`), `ultimo_consecutivo_ubicacion = 102`.
- **Datos de Entrada (Excel con 2 ítems):**
  - Fila 1: `Empaque Culata Cummins 6BT`, Familia: `Sistema Motor`
  - Fila 2: `Inyector Diesel Bosch`, Familia: `Sistema Motor`
- **Verificación:**
  ```sql
  SELECT i.codigo_interno, i.nombre_comercial, ub.codigo_ubicacion
  FROM inventario i
  JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
  JOIN catalogo_categorias c ON c.id = i.categoria_id
  WHERE c.nombre = 'Sistema Motor'
  ORDER BY i.created_at DESC LIMIT 2;
  ```
- **Criterio de Aceptación:**
  - Los 2 nuevos ítems reciben ubicaciones `103` y `104`.
  - `catalogo_categorias.ultimo_consecutivo_ubicacion` se actualiza a `104`.
  - Los 102 ítems anteriores conservan sus ubicaciones `001` a `102` intactas.

---

### Caso 3: Archivo Excel con varias familias mezcladas en el mismo lote
- **Objetivo:** Validar que filas intercaladas de diferentes familias no compartan ni interfieran sus secuencias.
- **Datos de Entrada (Excel intercalado):**
  - Fila 1: Item A - Familia: `Sistema Eléctrico` (tiene 137 ítems $\rightarrow$ debe dar `138`)
  - Fila 2: Item B - Familia: `Rodamientos y Sellos` (vacía $\rightarrow$ debe dar `001`)
  - Fila 3: Item C - Familia: `Sistema Eléctrico` $\rightarrow$ debe dar `139`
  - Fila 4: Item D - Familia: `Rodamientos y Sellos` $\rightarrow$ debe dar `002`
- **Verificación:**
  ```sql
  SELECT c.nombre, ub.codigo_ubicacion, i.nombre_comercial
  FROM inventario i
  JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
  JOIN catalogo_categorias c ON c.id = i.categoria_id
  WHERE i.nombre_comercial IN ('Item A', 'Item B', 'Item C', 'Item D')
  ORDER BY c.nombre, ub.codigo_ubicacion;
  ```
- **Criterio de Aceptación:**
  - Sistema Eléctrico asigna `138` y `139`.
  - Rodamientos y Sellos asigna `001` y `002`.
  - Ninguna secuencia salta números ni se cruza.

---

### Caso 4: Familia nueva creada después de la migración
- **Objetivo:** Garantizar que categorías creadas dinámicamente desde la interfaz o API funcionen correctamente.
- **Precondición:** Crear una nueva familia `Sistemas de Refrigeración` vía `POST /api/catalogo/categorias`.
- **Datos de Entrada:** Importar un Excel con 2 ítems para `Sistemas de Refrigeración`.
- **Verificación:**
  - El primer ítem recibe `001` y el segundo `002`.
  - `catalogo_categorias.ultimo_consecutivo_ubicacion = 2`.
- **Criterio de Aceptación:** Las familias nuevas inicializan su contador en `0` y autoincrementan desde `001`.

---

### Caso 5: Fila inválida en medio del lote (Tolerancia a Fallos y Consecutivos)
- **Objetivo:** Verificar que una fila errónea no queme números ni corrompa el consecutivo de las filas subsiguientes.
- **Datos de Entrada (Excel con 3 filas):**
  - Fila 1 (Válida): `Sensor Temperatura Motor`, Familia: `Sistema Motor`
  - Fila 2 (Inválida): Nombre Comercial vacío o Familia inexistente `FamiliaFantasma123`
  - Fila 3 (Válida): `Termostato 82C`, Familia: `Sistema Motor`
- **Verificación:**
  - La respuesta de la API debe ser HTTP 200 con `creados: 2`, `errores: 1 (Fila 3 de la hoja de cálculo)`.
  - Los ítems de la Fila 1 y Fila 3 deben quedar estrictamente correlativos (ej. si partía de 104 $\rightarrow$ Fila 1 = `105`, Fila 3 = `106`).
  - No debe quedar un hueco por la fila inválida.
- **Criterio de Aceptación:**
  - `ultimo_consecutivo_ubicacion` avanza exactamente en +2 (solo por las filas efectivamente creadas).

---

### Caso 6: Concurrencia — Dos importaciones simultáneas a la misma familia
- **Objetivo:** Comprobar que dos peticiones simultáneas no colisionen ni generen el mismo código de ubicación gracias al bloqueo `FOR UPDATE`.
- **Procedimiento de Prueba:**
  - Enviar mediante un script de prueba dos peticiones `POST /api/catalogo/import` en paralelo (`Promise.all`), cada una con un archivo Excel con 5 ítems de la misma familia.
- **Verificación:**
  ```sql
  SELECT ub.codigo_ubicacion, COUNT(*)
  FROM inventario i
  JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
  WHERE i.categoria_id = $1
  GROUP BY ub.codigo_ubicacion
  HAVING COUNT(*) > 1;
  ```
- **Criterio de Aceptación:**
  - La consulta retorna **0 duplicados**.
  - Se crearon los 10 ítems con consecutivos continuos y sin huecos ni interbloqueos (*deadlocks*).

---

### Caso 7: Creación manual de ítem individual (`CatalogFormPage`)
- **Objetivo:** Confirmar paridad entre la creación manual desde UI y la importación masiva.
- **Prueba 7A (Sin ubicación explícita - Comportamiento Default):**
  - Crear un ítem individual en "Sistema Motor" dejando la opción de ubicación por defecto.
  - *Resultado:* Se le asigna el siguiente consecutivo automático ($N+1$).
- **Prueba 7B (Con ubicación física explícita):**
  - Seleccionar en el formulario una ubicación específica de bodega (ej. un rack o posición específica `MOT-N3-L-01`).
  - *Resultado:* El ítem queda asignado a esa ubicación física y `ultimo_consecutivo_ubicacion` de la familia **no** se incrementa.

---

### Caso 8: Pruebas de Regresión
1. **Descarga de plantilla Excel:**
   - Descargar plantilla desde modal `CatalogImportModal`.
   - Verificar que el archivo `.xlsx` se descargue sin errores, con sus 18 columnas y hoja de instrucciones.
2. **Exportación de Catálogo a Excel:**
   - Ejecutar `Exportar Excel` desde la lista de catálogo.
   - Verificar que la columna `Ubicación Física` muestre correctamente los códigos `001`, `002`... en vez de valores nulos o repetidos erróneos.
3. **Código Interno Autoincremental:**
   - Confirmar que `codigo_interno` sigue generándose normalmente por familia según la migración 129 (ej. 1000..1137 para Eléctrico, 2000..N para Motor).
4. **Búsqueda Global:**
   - Buscar por nombre o referencia en la barra de búsqueda global del CRM y verificar que los productos aparezcan indexados correctamente.

---

### Caso 9: Reimportar el mismo archivo (Actualización de Ítems Existentes)
- **Objetivo:** Verificar que reimportar un archivo Excel con códigos internos existentes actualice los datos sin duplicar ubicaciones ni alterar los consecutivos ya asignados.
- **Procedimiento:**
  - Subir un Excel con productos existentes modificando su precio o stock.
- **Verificación:**
  - `actualizados` se incrementa.
  - La columna `ubicacion_id` del ítem existente **permanece inalterada**.
  - `catalogo_categorias.ultimo_consecutivo_ubicacion` **no** se incrementa.
- **Criterio de Aceptación:** Idempotencia en la actualización.

---

## 3. Estado de la Suite de Pruebas Automatizadas (Baseline)
Antes de iniciar cualquier cambio, se ejecutó `npm test` en el backend para establecer la línea base de pruebas preexistentes:
- **Pruebas fallidas preexistentes identificadas:**
  - `src/modules/horas_extras` (fallo de variables de entorno en tests jest).
  - `src/modules/email-marketing/emailMarketing.service.test.js` (fallo de variables de entorno en tests jest).
  - `src/modules/informes/gestionHumana.test.js` (fallo de variables de entorno en tests jest).
- **Causa conocida:** Los tests unitarios no cargan `.env` automáticamente al ejecutarse de forma aislada.
- Estas fallas históricas están documentadas y **no se confundirán con regresiones** del módulo de Catálogo.

---

## 4. Solicitud de Aprobación — GATE 2

Se solicita al usuario:
- Revisar y aprobar el **Plan de Pruebas Previo (FASE 2)** para proceder a la **FASE 3 (Implementación en rama nueva, dry-run y commits)**.
