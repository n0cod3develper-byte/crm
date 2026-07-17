# Análisis de Reconocimiento — Módulo Cotizaciones Cliente

Este documento recopila la investigación detallada de la estructura de base de datos, módulos existentes (cotización a proveedores, catálogo/inventario, autenticación) y la infraestructura del CRM de CARGAR S.A.S. para el desarrollo de la funcionalidad de **Cotizaciones Cliente**.

---

## 1. Módulo de Cotización a Proveedores (`supplier_quotes`)

El módulo existente se encarga de gestionar las solicitudes y ofertas de precios enviadas por proveedores.

### Esquema de Base de Datos
* **Tabla `supplier_quotes` (Cabecera):**
  * `id` (`uuid`): Clave primaria autogenerada (`DEFAULT gen_random_uuid()`).
  * `consecutivo` (`character varying`): Generado en formato `SQ-XXXXXX` mediante el timestamp del servidor.
  * `proveedor_id` (`uuid`): Referencia a la tabla `proveedores` (FK).
  * `contact_id` (`uuid`): Referencia a la tabla `contacts` (FK).
  * `telefono_contacto` (`character varying`): Teléfono del contacto directo en la cotización.
  * `company_id` (`uuid`): Referencia a la empresa (FK).
  * `estado` (`character varying`): Estado interno del flujo de la cotización (`BORRADOR`, `CREADO`, `APROBADO`, `ANULADO`).
  * `estado_comercial` (`character varying`): Estado comercial utilizado para el seguimiento del negocio. El estado por defecto al crear es **`EN_ESPERA`**.
  * `margen_utilidad` (`numeric`): Margen esperado (por defecto `23.00`).
  * `subtotal` y `total` (`numeric`): Valores monetarios calculados de la cotización.
  * `iva` (`numeric`): Porcentaje de IVA (por defecto `19.00`).
  * `numero_cotizacion` (`character varying`): Identificador manual dado por el proveedor.
  * `validez_oferta` (`integer`): Cantidad de días hábiles o de vigencia.
  * `forma_pago` (`character varying`): Método de pago pactado.
  * `created_by` (`uuid`): Creador del registro (FK a `users`).
  * `created_at` / `updated_at` (`timestamp with time zone`): Auditoría.

* **Tabla `supplier_quote_items` (Detalles):**
  * `id` (`uuid`): Clave primaria.
  * `supplier_quote_id` (`uuid`): FK a `supplier_quotes`.
  * `inventario_id` (`uuid`): FK opcional a la tabla `inventario`.
  * `codigo` (`character varying`): Código del ítem.
  * `cantidad` (`numeric`): Cantidad cotizada.
  * `precio_unitario` (`numeric`): Precio cobrado por el proveedor.
  * `descuento` (`numeric`): Descuento otorgado por el proveedor.
  * `iva` (`numeric`): IVA aplicable al ítem.
  * `comentarios` (`text`): Notas manuales.
  * `proveedor_id` (`uuid`): FK de redundancia al proveedor.
  * `company_id` (`uuid`): FK a la empresa.
  * `margen_utilidad` (`numeric`): Porcentaje de margen aplicado.
  * `descripcion_manual` (`character varying`): Descripción del ítem ingresado manualmente si no viene del inventario.

### Endpoints y Lógica Reutilizable
* Las rutas se configuran en `supplier_quotes.routes.js`.
* Para listar cotizaciones filtrando por estado, se expone `GET /api/v1/supplier-quotes?status=...`. Adicionalmente, podemos filtrar o verificar el `estado_comercial = 'EN_ESPERA'` consultando a la base de datos.

---

## 2. Módulo de Catálogo e Inventario (`inventario`)

### Esquema de Base de Datos
* **Tabla `inventario`:**
  * `id` (`uuid`): Clave primaria.
  * `tipo` (`character varying`): `PRODUCTO` o `SERVICIO`.
  * `codigo_interno` (`character varying`): Código único autogenerado (ej. `PRD-XXXXX`, `SRV-XXXXX`).
  * `nombre_comercial` o `name` (`character varying`): Nombre identificador.
  * `activo_catalogo` (`boolean`): Bandera para indicar si el ítem debe figurar en el catálogo de ventas.
  * `stock_actual` (`integer`): Cantidad física actual disponible en almacén.
  * `stock_minimum` (`integer`): Cantidad crítica mínima.
  * `costo_reposicion` / `costo_promedio_ponderado` (`numeric`): Costos de adquisición del ítem.
  * `unit_price` / `precio_venta_sugerido` (`numeric`): Precios al público recomendados.
  * `precio_piso` (`numeric`): Precio mínimo permitido en ventas regulares.

* **Vista `catalogo_completo`:**
  * Vista unificada que une y formatea los campos de `inventario` para facilitar búsquedas en el frontend de ventas.
  * Columnas expuestas: `id`, `tipo`, `codigo_interno`, `nombre_comercial`, `precio_venta`, `costo_o_minimo`, `unidad_medida`, `stock_actual`.

* **Tabla `inventario_reservas` (Reservas soft):**
  * `id` (`uuid`): Clave primaria.
  * `inventario_id` (`uuid`): Referencia a `inventario.id` (FK).
  * `quote_id` (`uuid`): Referencia a la cotización de cliente `quotes.id` (FK).
  * `quote_item_id` (`uuid`): Referencia al ítem específico de la cotización `quote_items.id` (FK).
  * `cantidad_reservada` (`integer`): Cantidad apartada temporalmente.
  * `estado` (`character varying`): Estado de la reserva (ej. `activa`, `completada`, `liberada`).
  * `creado_en` y `expira_en` (`timestamp with time zone`): Límites temporales para control de vigencia.

### Endpoints y Métodos de Disponibilidad
* El repositorio `InventoryRepository` cuenta con el método `getAvailability(id)` que calcula:
  $$\text{Stock Disponible} = \text{Stock Físico} - \text{Reservas Activas}$$
* Existe el endpoint `GET /api/v1/catalog` (o `/api/v1/catalog/search`) que usa `CatalogRepository` para retornar los ítems habilitados con stock y precios.

---

## 3. Autenticación y Middleware

* **Mapeo:** La seguridad está controlada a nivel global por el middleware `authenticate` cargado desde `backend/src/middleware/auth.js`.
* **Roles:** El objeto `req.user` inyecta información sobre el usuario logueado, incluyendo `id`, `email` y `roles` (ej. `admin`, `agent`).
* **Permisos:** La tabla `roles_permisos` controla si un rol puede realizar acciones específicas (`puede_ver`, `puede_crear`, `puede_editar`, `puede_eliminar`, `puede_aprobar`) sobre un módulo determinado de la tabla `modulos_sistema`.

---

## 4. Generación de PDF en el Backend

El backend del CRM ya cuenta con una infraestructura de renderizado de PDFs usando **Puppeteer**:
* **Ubicación:** `backend/src/utils/pdfGenerator.js`
* **Patrón:** Se construye una plantilla HTML dinámica inyectando variables, se inicia una instancia Headless de Chrome con Puppeteer (`headless: 'new'`), se renderiza la página HTML con `page.setContent()` y se genera el Buffer del PDF con `page.pdf()` para ser servido directamente o guardado en el storage.
* **Recursos:** El logo de la corporación se lee desde `backend/src/assets/logo.png` y se codifica como base64 para evitar peticiones externas dentro de Puppeteer.

---

## 5. Análisis del Módulo de Cotizaciones a Clientes Existente (`quotes`)

Sorprendentemente, ya existe un módulo llamado `quotes` y `quote_items` en la base de datos PostgreSQL y en la estructura del backend/frontend del proyecto. 

### Análisis de la estructura de `quote_items` existente:
Hemos descubierto que la tabla `quote_items` contiene precisamente las columnas necesarias para cumplir con las reglas de negocio solicitadas:
* `origen` (`character varying`): Para diferenciar si proviene de `'inventario'` (catálogo propio) o `'proveedor'` (cotización externa).
* `inventario_id` (`uuid`): ID del catálogo de inventario.
* `proveedor_id` (`uuid`): ID del proveedor (referencia a tabla `proveedores`).
* `costo_base` (`numeric`): El costo original del ítem para aplicar el cálculo de markup del 23%.
* `porcentaje_incremento` (`numeric`): Margen o markup aplicado (por defecto 23%).
* `autorizado_por` (`uuid`): ID del administrador que autoriza descuentos por debajo del umbral mínimo.
* `justificacion_descuento` (`text`): Texto descriptivo del porqué de la rebaja.
* `stock_verificado_en` y `stock_disponible_al_verificar`: Registros temporales para la validación de stock disponible.

### Conclusión para el Checkpoint de Fase 1:
Dado que el módulo `quotes` existente ya tiene la mitad de los cimientos en la base de datos y en los repositorios, y para respetar al máximo el principio de no redundancia ni desperdicio de código:

1. **Opción A (Recomendada):** Completar y adecuar la lógica de negocio en el módulo `quotes` existente, integrando las validaciones atómicas de stock, reservas de inventario al crear/modificar cotizaciones, y el selector de cotizaciones de proveedores en estado "En espera".
2. **Opción B:** Construir un módulo 100% aislado e independiente llamado `cotizaciones-cliente` desde cero. Esto crearía tablas duplicadas o conflictos conceptuales en el CRM.

> [!WARNING]
> **REGLA DE ORO DE Robinson:** No tocaremos ningún código de controlador, servicio o repositorio del módulo `quotes` o `inventario` hasta obtener tu autorización explícita para la Fase 2 y Fase 3.
