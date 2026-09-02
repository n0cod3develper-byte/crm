# Estado Actual — CARGAR CRM (fecha de auditoría: 1 de agosto de 2026)

## Resumen ejecutivo
Desde la última documentación consolidada, el sistema evolucionó de una arquitectura con dependencias de librerías de analítica de terceros (Cube.js eliminadas) hacia un núcleo nativo optimizado en Node.js y PostgreSQL. Se implementaron 96 migraciones de base de datos, se completó el módulo Enterprise de Tareas (reemplazando los placeholders/mocks antiguos por vistas funcionales Kanban, Calendario y Lista), y se añadieron los módulos de Cotizaciones a Proveedores, Presupuestos por Línea de Negocio, Centros de Costos, Mantenimiento Locativo, Respaldos Automatizados (Backups con job 02:00 AM) y el Cierre Contable Mensual de OTs (en etapa final de desarrollo local). La infraestructura corre sobre Node.js con PM2 en modo Cluster y Nginx con soporte SPA desplegado en servidor VPS (Dokploy / App0Code).

---

## Módulos

### 1. Equipos
- **Estado**: Actualizado
- **Descripción funcional**: Control integral de parque automotor y activos (Montacargas, Cargadores, Baterías, Estibadores). Incluye seguimiento de horómetros, alertas y notificaciones automáticas por correo para vencimiento de SOAT (job diario a las 06:00 AM) y actualización automática de estado operativo según remisiones asociadas.
- **Endpoints clave**:
  - `GET /api/v1/equipos` — Listado con filtros y paginación
  - `POST /api/v1/equipos` — Registro de nuevo equipo
  - `PUT /api/v1/equipos/:id` — Edición de datos del equipo
  - `GET /api/v1/empresas/:id/equipos` — Equipos por cliente
- **Tablas de BD involucradas**: `equipos`, `equipos_horometros`, `equipos_mantenimiento`
- **Componentes frontend clave**: [EquiposPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Equipos/EquiposPage.jsx), `EquipoModal.jsx`, `EquipoFichaModal.jsx`
- **Pendientes o issues conocidos**: Se ampliaron los tipos de equipo en la migración 092 para soporte de Cargadores y Baterías.

---

### 2. Mantenimiento & Órdenes de Trabajo (OT)
- **Estado**: Actualizado
- **Descripción funcional**: Gestión de OTs correctivas y preventivas. Control de horas de llegada/salida de técnicos en planta CARGAR y en instalaciones del cliente, modal de resumen de actividades (icono ListChecks restringido a OTs liquidadas), exportación en PDF de 1 página, catálogo unificado de sistemas/componentes, presupuesto por línea de negocio e ítems de mano de obra adicional.
- **Endpoints clave**:
  - `GET /api/v1/mantenimiento` — Listado de OTs
  - `POST /api/v1/mantenimiento` — Creación de OT
  - `GET /api/v1/mantenimiento/:id` — Detalle de OT
  - `PATCH /api/v1/mantenimiento/:id/liquidar` — Liquidación de OT
  - `GET /api/v1/mantenimiento/:id/pdf` — Generación de PDF impreso
- **Tablas de BD involucradas**: `ordenes_trabajo`, `ot_tecnicos`, `ot_repuestos`, `ot_actividades`, `mantenimiento_componentes`, `mantenimiento_presupuestos`, `ot_mano_obra_adicional`
- **Componentes frontend clave**: [MantenimientoPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Mantenimiento/MantenimientoPage.jsx), [OTFormPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Mantenimiento/OTFormPage.jsx), [OTDetailPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Mantenimiento/OTDetailPage.jsx), [ComponentesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Mantenimiento/ComponentesPage.jsx)
- **Pendientes o issues conocidos**: Ningún bug bloqueante.

---

### 3. Cierre Contable Mensual de OTs (Cortes Contables)
- **Estado**: Nuevo (Desarrollado en trabajo local no commiteado / untracked)
- **Descripción funcional**: Módulo para la generación y consulta de cortes contables periódicos sobre órdenes de mantenimiento continuo y servicios de alquiler. Incluye ejecución de job automatizado (`iniciarJobCierreContableOT`).
- **Endpoints clave**:
  - `GET /api/v1/mantenimiento/cortes` — Listado de cortes contables
  - `POST /api/v1/mantenimiento/cortes` — Generación de nuevo corte
- **Tablas de BD involucradas**: `cortes_contables_ot`, `corte_contable_ot_detalles` (definidas en [096_cierre_contable_ot.sql](file:///c:/Users/user/Documents/Proyectos/crm/backend/migrations/096_cierre_contable_ot.sql))
- **Componentes frontend clave**: [CortesContablesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Mantenimiento/CortesContablesPage.jsx)
- **Pendientes o issues conocidos**: Los archivos correspondientes a este módulo están presentes en el espacio de trabajo local pero pendientes de commitear en git por parte de Robinson.

---

### 4. Inventario & Catálogo Unificado
- **Estado**: Actualizado
- **Descripción funcional**: Control de inventario FIFO de repuestos, artículos y consumibles. Pisos de precio (costo de reposición), bodegas, áreas de inventario, registro de movimientos (entradas, salidas, ajustes de stock) y catálogo unificado visual con familias de productos.
- **Endpoints clave**:
  - `GET /api/v1/inventory` — Existencias en inventario
  - `POST /api/v1/inventory/movements` — Registro de movimientos/ajustes
  - `GET /api/v1/catalogo` — Dashboard y listado de catálogo
- **Tablas de BD involucradas**: `inventory_items`, `inventory_movements`, `bodegas`, `areas_inventario`, `catalog_items`, `familias`
- **Componentes frontend clave**: [InventoryPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Inventory/InventoryPage.jsx), [CatalogDashboardPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Inventory/CatalogDashboardPage.jsx), [CatalogListPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Inventory/CatalogListPage.jsx), [MovementsPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Inventory/MovementsPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 5. Servicios & Remisiones
- **Estado**: Actualizado
- **Descripción funcional**: Gestión de prestación de servicios y alquiler de maquinaria/operarios. Remisiones con múltiples ítems de servicio, cálculo de horas ordinarias/recargos (franjas horarias), tope mínimo de horas y generación de remisión en PDF.
- **Endpoints clave**:
  - `GET /api/v1/servicios` — Listado de remisiones de servicios
  - `POST /api/v1/servicios` — Creación de remisión
  - `PUT /api/v1/servicios/:id` — Edición de remisión
  - `GET /api/v1/catalogo-servicios` — Tarifario de servicios
- **Tablas de BD involucradas**: `servicios_remisiones`, `remision_servicios`, `catalogo_servicios`
- **Componentes frontend clave**: [ServiciosPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Servicios/ServiciosPage.jsx), [RemisionFormPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Servicios/RemisionFormPage.jsx), [RemisionDetailPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Servicios/RemisionDetailPage.jsx)
- **Pendientes o issues conocidos**: Cuenta con cobertura de pruebas unitarias en `backend/src/modules/servicios/__tests__/servicios.test.js`.

---

### 6. Facturación
- **Estado**: Confirmado
- **Descripción funcional**: Pre-facturación de OTs liquidadas y remisiones de servicios completadas. Registro de facturas emitidas, desglose de IVA y consulta de historial.
- **Endpoints clave**:
  - `GET /api/v1/facturacion/pendientes` — OTs y servicios listos para facturar
  - `GET /api/v1/facturacion/facturas` — Listado de facturas
  - `POST /api/v1/facturacion` — Emisión de factura
- **Tablas de BD involucradas**: `facturas`, `factura_lineas`
- **Componentes frontend clave**: [DashboardFacturacionPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Facturacion/DashboardFacturacionPage.jsx), [OtsPendientesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Facturacion/OtsPendientesPage.jsx), [FacturasListPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Facturacion/FacturasListPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 7. Turnos & Horas Extra (CST)
- **Estado**: Actualizado
- **Descripción funcional**: Control de marcación de turnos de personal operativo. Algoritmo de desglose automático de horas extra conforme al Código Sustantivo del Trabajo (CST) de Colombia (recargos nocturnos, festivos y dominicales). Cron job diario de cierre automático a las 23:59.
- **Endpoints clave**:
  - `GET /api/v1/turnos` — Historial de turnos
  - `POST /api/v1/turnos/iniciar` — Marcación de entrada
  - `POST /api/v1/turnos/cerrar` — Marcación de salida
- **Tablas de BD involucradas**: `turnos`, `turnos_desglose_cst`, `festivos_colombia`
- **Componentes frontend clave**: [TurnoPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Turnos/TurnoPage.jsx), [TurnoSupervisorPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Turnos/TurnoSupervisorPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 8. Proveedores & Órdenes de Compra (Compras)
- **Estado**: Actualizado
- **Descripción funcional**: Gestión del ciclo de abastecimiento: registro de proveedores, solicitudes de compra, aprobaciones por niveles de monto (Nivel 1, Nivel 2, Nivel 3) y recepción física de mercancía en bodega.
- **Endpoints clave**:
  - `GET /api/v1/proveedores` — Directorio de proveedores
  - `GET /api/v1/compras/solicitudes` — Solicitudes de compra
  - `GET /api/v1/compras/oc` — Órdenes de compra
  - `POST /api/v1/compras/aprobaciones` — Aprobación de OC por nivel
- **Tablas de BD involucradas**: `proveedores`, `solicitudes_compra`, `ordenes_compra`, `recepciones_mercancia`
- **Componentes frontend clave**: [ProveedoresListPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Proveedores/ProveedoresListPage.jsx), [DashboardComprasPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Compras/DashboardComprasPage.jsx), [SolicitudesListPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Compras/SolicitudesListPage.jsx), [OrdenesCompraPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Compras/OrdenesCompraPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 9. Cotizaciones de Proveedores (Supplier Quotes)
- **Estado**: Nuevo / Actualizado
- **Descripción funcional**: Módulo especializado para recepcionar, auditar y comparar cotizaciones remitidas por proveedores, especificando IVA global o detallado e indicadores de tiempo de entrega.
- **Endpoints clave**:
  - `GET /api/v1/supplier-quotes` — Listado de cotizaciones de proveedores
  - `POST /api/v1/supplier-quotes` — Creación de cotización
  - `PUT /api/v1/supplier-quotes/:id` — Modificación de cotización
- **Tablas de BD involucradas**: `supplier_quotes`, `supplier_quote_items` (migraciones 072 a 079, 082, 091)
- **Componentes frontend clave**: [SupplierQuotesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/SupplierQuotes/SupplierQuotesPage.jsx), [SupplierQuoteForm.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/SupplierQuotes/SupplierQuoteForm.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 10. Cotizaciones a Clientes
- **Estado**: Confirmado
- **Descripción funcional**: Elaboración de cotizaciones para clientes con margen de utilidad/markup por defecto del 23%, opción de bloqueo/reserva de stock en inventario y exportación a PDF.
- **Endpoints clave**:
  - `GET /api/v1/quotes` — Cotizaciones emitidas
  - `POST /api/v1/quotes` — Creación de cotización
  - `GET /api/v1/quotes/:id` — Ver detalle
- **Tablas de BD involucradas**: `cotizaciones_cliente`, `cotizacion_items`
- **Componentes frontend clave**: [QuotesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Quotes/QuotesPage.jsx), [QuoteDetailPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Quotes/QuoteDetailPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 11. Tareas Enterprise
- **Estado**: Actualizado (Se superó el estado "Mock" documentado previamente)
- **Descripción funcional**: Sistema completo de gestión de tareas con soporte multitabla, priorización (Crítica, Alta, Media, Baja), categorización, asignación de responsables, fechas de vencimiento, subtareas y 3 vistas interactivas: Lista, Kanban y Calendario.
- **Endpoints clave**:
  - `GET /api/v1/tasks` — Listado de tareas con filtros
  - `POST /api/v1/tasks` — Crear tarea
  - `PATCH /api/v1/tasks/:id` — Actualizar estado/datos
  - `DELETE /api/v1/tasks/:id` — Eliminar tarea
- **Tablas de BD involucradas**: `tasks` (actualizada en migración [093_tasks_enterprise_fields.sql](file:///c:/Users/user/Documents/Proyectos/crm/backend/migrations/093_tasks_enterprise_fields.sql))
- **Componentes frontend clave**: [TasksPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Tasks/TasksPage.jsx), [TasksListView.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Tasks/views/TasksListView.jsx), [TasksKanbanView.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Tasks/views/TasksKanbanView.jsx), [TasksCalendarView.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Tasks/views/TasksCalendarView.jsx)
- **Pendientes o issues conocidos**: El issue previo de la vista "Mock" fue totalmente resuelto en el commit `72830b7`.

---

### 12. RBAC Dinámico & Administración
- **Estado**: Actualizado
- **Descripción funcional**: Control de acceso basado en roles dinámicos persistidos en PostgreSQL. Matriz granular de permisos por módulo (`puede_ver`, `puede_crear`, `puede_editar`, `puede_eliminar`, `puede_exportar`, `puede_aprobar`, `puede_liquidar`) con bitácora de auditoría.
- **Endpoints clave**:
  - `GET /api/v1/admin/roles` — Consulta de roles
  - `POST /api/v1/admin/roles` — Creación de rol dinámico
  - `PUT /api/v1/admin/roles/:id/permisos` — Actualización de matriz
  - `GET /api/v1/admin/users` — Gestión de usuarios CRM
- **Tablas de BD involucradas**: `roles`, `modulos_sistema`, `roles_permisos`, `auditoria_permisos`, `usuarios_crm`
- **Componentes frontend clave**: [RolesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Admin/RolesPage.jsx), [UsersPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Admin/UsersPage.jsx), [ModulesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Admin/ModulesPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 13. Informes & BI
- **Estado**: Actualizado
- **Descripción funcional**: Centro de reportes y analítica empresarial (Servicios, Mantenimiento, Horas Extras y Bonificaciones de Gestión Humana). Se migró de la arquitectura de Cube.js a consultas SQL agregadas de alto rendimiento.
- **Endpoints clave**:
  - `GET /api/v1/informes/kpis` — Métricas generales
  - `GET /api/v1/informes/servicios` — Reporte de ventas de servicios
  - `GET /api/v1/informes/horas-extras` — Consolidado de horas extra
- **Tablas de BD involucradas**: Consultas multitabla sobre `ordenes_trabajo`, `servicios_remisiones`, `turnos`, `employees`.
- **Componentes frontend clave**: [InformesIndexPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Informes/InformesIndexPage.jsx), [InformesServiciosPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Informes/InformesServiciosPage.jsx), [InformesGestionHumanaPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Informes/InformesGestionHumanaPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 14. Presupuestos (Budget)
- **Estado**: Nuevo
- **Descripción funcional**: Módulo para definir y comparar presupuestos financieros por áreas operativas y líneas de negocio.
- **Endpoints clave**:
  - `GET /api/v1/budget` — Consultar presupuestos
  - `POST /api/v1/budget` — Registrar presupuesto por área
- **Tablas de BD involucradas**: `presupuestos_area`, `presupuesto_detalles` (migración [085_budget_mantenimiento.sql](file:///c:/Users/user/Documents/Proyectos/crm/backend/migrations/085_budget_mantenimiento.sql))
- **Componentes frontend clave**: [BudgetIndexPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Presupuestos/BudgetIndexPage.jsx), [BudgetFormPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Presupuestos/BudgetFormPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 15. Centros de Costos
- **Estado**: Nuevo
- **Descripción funcional**: Definición de la estructura de centros de costos para la imputación contable de repuestos, servicios y horas operativas.
- **Endpoints clave**:
  - `GET /api/v1/centros-costos` — Listado de centros de costo
  - `POST /api/v1/centros-costos` — Creación/edición
- **Tablas de BD involucradas**: `centros_costos`, `centro_costo_items` (migraciones 069, 070, 071)
- **Componentes frontend clave**: [CentrosCostosPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/CentrosCostos/CentrosCostosPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 16. Generador de Prompts (Prompt Specs)
- **Estado**: Actualizado (Desarrollado e integrado totalmente)
- **Descripción funcional**: Herramienta interna de la sección "Sistemas" para administrar plantillas de prompts de IA (`prompt_specs`).
- **Endpoints clave**:
  - `GET /api/prompt-specs` — Consultar especificaciones
  - `POST /api/prompt-specs` — Crear/guardar especificaciones
- **Tablas de BD involucradas**: `prompt_specs` (migración [066_prompt_specs.sql](file:///c:/Users/user/Documents/Proyectos/crm/backend/migrations/066_prompt_specs.sql))
- **Componentes frontend clave**: [PromptGeneratorPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Sistemas/PromptGeneratorPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

### 17. Gestión Humana & Certificados
- **Estado**: Actualizado
- **Descripción funcional**: Ficha de empleados con información de SST, licencias y bonificaciones. Cuenta con rutas públicas para solicitud y descarga de certificados laborales.
- **Endpoints clave**:
  - `GET /api/v1/employees` — Ficha de empleados
  - `GET /api/v1/certificados` — Gestión de certificados
- **Tablas de BD involucradas**: `employees`, `certificados_solicitudes`
- **Componentes frontend clave**: [EmployeesPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Employees/EmployeesPage.jsx), [SolicitarCertificadoPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/CertificadosPublico/SolicitarCertificadoPage.jsx), [DescargarCertificadoPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/CertificadosPublico/DescargarCertificadoPage.jsx)
- **Recomendación técnica**: Se recomienda reemplazar el texto descriptivo `(Mock)` por etiquetas profesionales como `(Portal de Certificados)` o `(Solicitud en Línea)` en el siguiente ciclo de mantenimiento de UI.

---

### 18. Mantenimiento Locativo
- **Estado**: Nuevo
- **Descripción funcional**: Módulo para la recepción y control de requerimientos de mantenimiento sobre instalaciones físicas y sedes.
- **Endpoints clave**:
  - `GET /api/v1/inventario/locativo` — Solicitudes de mantenimiento locativo
- **Tablas de BD involucradas**: `locativo_solicitudes` (migración [048_locativo_module.sql](file:///c:/Users/user/Documents/Proyectos/crm/backend/migrations/048_locativo_module.sql))
- **Componentes frontend clave**: Integrado en pestañas dentro de Mantenimiento.
- **Pendientes o issues conocidos**: Ninguno.

---

### 19. Respaldos de Base de Datos (Backups)
- **Estado**: Nuevo
- **Descripción funcional**: Módulo de administración para la generación instantánea y programación de copias de seguridad de la base de datos PostgreSQL. Job automático ejecutado diariamente a las 02:00 AM.
- **Endpoints clave**:
  - `GET /api/backups` — Listado de respaldos disponibles
  - `POST /api/backups/generar` — Forzar copia de seguridad
  - `GET /api/backups/descargar/:filename` — Descarga segura
- **Tablas de BD involucradas**: Archivos `.sql.gz` almacenados en directorio securizado de servidor.
- **Componentes frontend clave**: [BackupsPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/Admin/BackupsPage.jsx)
- **Pendientes o issues conocidos**: Ninguno.

---

## Cambios de infraestructura/despliegue
- **Arquitectura de Ejecución**: Backend ejecutándose sobre **Node.js** administrado por **PM2 en modo Cluster** (`exec_mode: 'cluster'`, `instances: 'max'`) para aprovechamiento multinúcleo en el servidor VPS Hostinger (`root@app0code.cloud`).
- **Controlador Inverso & Proxy**: Express configurado con `app.set('trust proxy', 1)` detrás de Traefik / Nginx en Dokploy.
- **Frontend SPA**: Servidor **Nginx Alpine** empaquetado en contenedor Docker con directiva `try_files $uri $uri/ /index.html` y compresión `gzip` habilitada para activos estáticos.
- **Runner Automático de Migraciones**: Al desplegar o reiniciar el backend, se invoca automáticamente [runner.js](file:///c:/Users/user/Documents/Proyectos/crm/backend/migrations/runner.js) para aplicar secuencias SQL pendientes en orden numérico estricto (001 a 096).
- **Servicios de Fondo (Jobs express/cron)**:
  1. `iniciarJobCierreAutomatico()` — Cierre automático de turnos abiertos a las 23:59 (America/Bogota).
  2. `iniciarJobSoatEmail()` — Envío de alertas de vencimiento de SOAT a las 06:00 AM.
  3. `iniciarJobCierreContableOT()` — Procesamiento de cierre contable mensual.
  4. `initBackupCronJob()` — Copia de seguridad automatizada de la base de datos a las 02:00 AM.

---

## Inconsistencias detectadas & Notas de Seguimiento
1. **Etiquetas Visuales en Certificados Públicos**: Los componentes frontend [SolicitarCertificadoPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/CertificadosPublico/SolicitarCertificadoPage.jsx) y [DescargarCertificadoPage.jsx](file:///c:/Users/user/Documents/Proyectos/crm/frontend/src/pages/CertificadosPublico/DescargarCertificadoPage.jsx) conservan el rotulado `(Mock)` en sus encabezados.
2. **Archivos Locales Untracked (Cierre Contable)**: En el espacio de trabajo local existen 5 archivos sin commitear referentes al cierre contable que se incluirán en el control de versiones en una fase posterior:
   - `backend/migrations/096_cierre_contable_ot.sql`
   - `backend/src/jobs/cierreContableOT.job.js`
   - `backend/src/modules/mantenimiento/corteContable.controller.js`
   - `backend/src/modules/mantenimiento/corteContable.repository.js`
   - `frontend/src/pages/Mantenimiento/CortesContablesPage.jsx`
3. **Mantenimiento de Repositorio**: La rama remota `origin/Rama_Actualización_Emily` contiene desarrollos ya integrados a `main`, por lo que puede ser depurada o cerrada en el repositorio central cuando el equipo lo considere conveniente.
