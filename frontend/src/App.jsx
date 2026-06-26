import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';


// Stores & Contexts
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary, SafeModule } from './components/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';

// --- Configuración Global de Cube.js ---


// Lazy loaded pages
const LoginPage = lazy(() => import('./pages/Auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const AuthCallback = lazy(() => import('./pages/Auth/AuthCallback').then(m => ({ default: m.AuthCallbackPage })));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CompaniesPage = lazy(() => import('./pages/Companies/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const CompanyDetailPage = lazy(() => import('./pages/Companies/CompanyDetailPage').then(m => ({ default: m.CompanyDetailPage })));
const ContactsPage = lazy(() => import('./pages/Contacts/ContactsPage').then(m => ({ default: m.ContactsPage })));
const PipelinePage = lazy(() => import('./pages/Pipeline/PipelinePage').then(m => ({ default: m.PipelinePage })));
const TasksPage = lazy(() => import('./pages/Tasks/TasksPage').then(m => ({ default: m.TasksPage })));
const QuotesPage = lazy(() => import('./pages/Quotes/QuotesPage').then(m => ({ default: m.QuotesPage })));
const LeadsPage = lazy(() => import('./pages/Leads/LeadsPage').then(m => ({ default: m.LeadsPage })));
const InventoryPage = lazy(() => import('./pages/Inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const CampaignsPage = lazy(() => import('./pages/Campaigns/CampaignsPage').then(m => ({ default: m.CampaignsPage })));
const SupportPage = lazy(() => import('./pages/Support/SupportPage').then(m => ({ default: m.SupportPage })));
const EmployeesPage = lazy(() => import('./pages/Employees/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const EquiposPage = lazy(() => import('./pages/Equipos/EquiposPage').then(m => ({ default: m.EquiposPage })));
const MantenimientoPage = lazy(() => import('./pages/Mantenimiento/MantenimientoPage').then(m => ({ default: m.MantenimientoPage })));
const OTFormPage = lazy(() => import('./pages/Mantenimiento/OTFormPage').then(m => ({ default: m.OTFormPage })));
const OTDetailPage = lazy(() => import('./pages/Mantenimiento/OTDetailPage').then(m => ({ default: m.OTDetailPage })));
const CatalogDashboardPage = lazy(() => import('./pages/Inventory/CatalogDashboardPage').then(m => ({ default: m.CatalogDashboardPage })));
const CatalogListPage = lazy(() => import('./pages/Inventory/CatalogListPage').then(m => ({ default: m.CatalogListPage })));
const CatalogFormPage = lazy(() => import('./pages/Inventory/CatalogFormPage').then(m => ({ default: m.CatalogFormPage })));
const CatalogItemDetailPage = lazy(() => import('./pages/Inventory/CatalogItemDetailPage').then(m => ({ default: m.CatalogItemDetailPage })));
const MovementsPage = lazy(() => import('./pages/Inventory/MovementsPage').then(m => ({ default: m.MovementsPage })));
const PMAdminPage = lazy(() => import('./pages/Mantenimiento/PMAdminPage').then(m => ({ default: m.PMAdminPage })));
const UbicacionesPage = lazy(() => import('./pages/Inventory/UbicacionesPage').then(m => ({ default: m.UbicacionesPage })));
const FamiliesPage = lazy(() => import('./pages/Inventory/FamiliesPage').then(m => ({ default: m.FamiliesPage })));

const ProveedoresListPage = lazy(() => import('./pages/Proveedores/ProveedoresListPage').then(m => ({ default: m.ProveedoresListPage })));
const ProveedorFormPage = lazy(() => import('./pages/Proveedores/ProveedorFormPage').then(m => ({ default: m.ProveedorFormPage })));
const ProveedorFichaPage = lazy(() => import('./pages/Proveedores/ProveedorFichaPage').then(m => ({ default: m.ProveedorFichaPage })));

const DashboardComprasPage = lazy(() => import('./pages/Compras/DashboardComprasPage').then(m => ({ default: m.DashboardComprasPage })));
const SolicitudesListPage = lazy(() => import('./pages/Compras/SolicitudesListPage').then(m => ({ default: m.SolicitudesListPage })));
const SolicitudFormPage = lazy(() => import('./pages/Compras/SolicitudFormPage').then(m => ({ default: m.SolicitudFormPage })));
const ComparacionCotizacionesPage = lazy(() => import('./pages/Compras/ComparacionCotizacionesPage').then(m => ({ default: m.ComparacionCotizacionesPage })));
const OrdenesCompraPage = lazy(() => import('./pages/Compras/OrdenesCompraPage').then(m => ({ default: m.OrdenesCompraPage })));
const OrdenCompraFormPage = lazy(() => import('./pages/Compras/OrdenCompraFormPage').then(m => ({ default: m.OrdenCompraFormPage })));
const AprobacionesPage = lazy(() => import('./pages/Compras/AprobacionesPage').then(m => ({ default: m.AprobacionesPage })));
const RecepcionMercanciaPage = lazy(() => import('./pages/Compras/RecepcionMercanciaPage').then(m => ({ default: m.RecepcionMercanciaPage })));
const Error403Page = lazy(() => import('./pages/Auth/Error403Page').then(m => ({ default: m.Error403Page })));
const FacturacionDashboard = lazy(() => import('./pages/Facturacion/DashboardFacturacionPage').then(m => ({ default: m.DashboardFacturacionPage })));
const OtsPendientesPage = lazy(() => import('./pages/Facturacion/OtsPendientesPage').then(m => ({ default: m.OtsPendientesPage })));
const FacturasListPage = lazy(() => import('./pages/Facturacion/FacturasListPage').then(m => ({ default: m.FacturasListPage })));
const FacturaDetailPage = lazy(() => import('./pages/Facturacion/FacturaDetailPage').then(m => ({ default: m.FacturaDetailPage })));
const RolesPage = lazy(() => import('./pages/Admin/RolesPage').then(m => ({ default: m.RolesPage })));
const UsersPage = lazy(() => import('./pages/Admin/UsersPage').then(m => ({ default: m.UsersPage })));
const ModulesPage = lazy(() => import('./pages/Admin/ModulesPage').then(m => ({ default: m.ModulesPage })));
const BackupsPage = lazy(() => import('./pages/Admin/BackupsPage').then(m => ({ default: m.BackupsPage })));

const CatalogoServiciosPage = lazy(() => import('./pages/CatalogoServicios/CatalogoServiciosPage').then(m => ({ default: m.CatalogoServiciosPage })));
const ServiciosPage = lazy(() => import('./pages/Servicios/ServiciosPage').then(m => ({ default: m.ServiciosPage })));
const RemisionFormPage = lazy(() => import('./pages/Servicios/RemisionFormPage').then(m => ({ default: m.RemisionFormPage })));
const RemisionDetailPage = lazy(() => import('./pages/Servicios/RemisionDetailPage').then(m => ({ default: m.RemisionDetailPage })));

const SalesReportServicios = lazy(() => import('./pages/Reportes/SalesReportServicios').then(m => ({ default: m.SalesReportServicios })));
const SalesReportMantenimiento = lazy(() => import('./pages/Reportes/SalesReportMantenimiento').then(m => ({ default: m.SalesReportMantenimiento })));
const TurnoPage = lazy(() => import('./pages/Turnos/TurnoPage').then(m => ({ default: m.TurnoPage })));
const TurnoSupervisorPage = lazy(() => import('./pages/Turnos/TurnoSupervisorPage').then(m => ({ default: m.TurnoSupervisorPage })));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const MantenimientosProgramados = lazy(() => import('./pages/MantenimientosProgramados').then(m => ({ default: m.default })));

const InformesIndexPage = lazy(() => import('./pages/Informes/InformesIndexPage').then(m => ({ default: m.InformesIndexPage })));
const InformesServiciosPage = lazy(() => import('./pages/Informes/InformesServiciosPage').then(m => ({ default: m.InformesServiciosPage })));
const InformesMantenimientoPage = lazy(() => import('./pages/Informes/InformesMantenimientoPage').then(m => ({ default: m.InformesMantenimientoPage })));
const InformesGestionHumanaPage = lazy(() => import('./pages/Informes/InformesGestionHumanaPage').then(m => ({ default: m.InformesGestionHumanaPage })));

const BudgetIndexPage = lazy(() => import('./pages/Presupuestos/BudgetIndexPage').then(m => ({ default: m.BudgetIndexPage })));
const BudgetFormPage = lazy(() => import('./pages/Presupuestos/BudgetFormPage').then(m => ({ default: m.BudgetFormPage })));

const PromptGeneratorPage = lazy(() => import('./pages/Sistemas/PromptGeneratorPage').then(m => ({ default: m.PromptGeneratorPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
    <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
  </div>
);

function App() {
  const { user } = useAuth();
  const applyTheme = useThemeStore(s => s.applyTheme);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    
      <QueryClientProvider client={queryClient}>
        <PermissionsProvider>
        
          <BrowserRouter basename="/">
            <ErrorBoundary>
            <div className="app-root">
              {user && <Sidebar />}
              <div className="app-main">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Rutas públicas */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Rutas protegidas */}
                <Route path="/dashboard" element={<SafeModule context="dashboard"><DashboardPage /></SafeModule>} />
                <Route path="/companies" element={<ProtectedRoute modulo="empresas" accion="ver"><CompaniesPage /></ProtectedRoute>} />
                <Route path="/companies/:id" element={<ProtectedRoute modulo="empresas" accion="ver"><CompanyDetailPage /></ProtectedRoute>} />
                <Route path="/inventory" element={<SafeModule context="inventario" modulo="inventario" accion="ver"><InventoryPage /></SafeModule>} />
                <Route path="/inventory/ubicaciones" element={<SafeModule context="inventario" modulo="inventario" accion="ver"><UbicacionesPage /></SafeModule>} />
                <Route path="/catalogo" element={<SafeModule context="inventario" modulo="catalogo" accion="ver"><CatalogDashboardPage /></SafeModule>} />
                <Route path="/catalogo/familias" element={<SafeModule context="inventario" modulo="catalogo" accion="ver"><FamiliesPage /></SafeModule>} />
                <Route path="/catalogo/items" element={<SafeModule context="inventario" modulo="catalogo" accion="ver"><CatalogListPage /></SafeModule>} />
                <Route path="/inventario/movimientos" element={<SafeModule context="inventario" modulo="inventario" accion="ver"><MovementsPage /></SafeModule>} />
                <Route path="/catalogo/:id" element={<SafeModule context="inventario" modulo="catalogo" accion="ver"><CatalogItemDetailPage /></SafeModule>} />
                <Route path="/catalogo/nuevo" element={<SafeModule context="inventario" modulo="catalogo" accion="crear"><CatalogFormPage /></SafeModule>} />
                <Route path="/catalogo/:id/editar" element={<SafeModule context="inventario" modulo="catalogo" accion="editar"><CatalogFormPage /></SafeModule>} />
                <Route path="/mantenimiento" element={<SafeModule context="mantenimiento" modulo="ordenes_trabajo" accion="ver"><MantenimientoPage /></SafeModule>} />
                <Route path="/mantenimiento/nueva" element={<SafeModule context="mantenimiento" modulo="ordenes_trabajo" accion="crear"><OTFormPage /></SafeModule>} />
                <Route path="/mantenimiento/configuracion" element={<SafeModule context="mantenimiento" adminOnly><PMAdminPage /></SafeModule>} />
                <Route path="/mantenimiento/:id/editar" element={<SafeModule context="mantenimiento" modulo="ordenes_trabajo" accion="editar"><OTFormPage /></SafeModule>} />
                <Route path="/mantenimiento/:id" element={<SafeModule context="mantenimiento" modulo="ordenes_trabajo" accion="ver"><OTDetailPage /></SafeModule>} />
                <Route path="/admin/roles" element={<ProtectedRoute adminOnly><RolesPage /></ProtectedRoute>} />
                <Route path="/admin/usuarios" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
                <Route path="/admin/modulos" element={<ProtectedRoute adminOnly><ModulesPage /></ProtectedRoute>} />

                {/* Compras */}
                <Route path="/compras" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><DashboardComprasPage /></ProtectedRoute>} />
                <Route path="/compras/aprobaciones" element={<ProtectedRoute modulo="ordenes_compra" accion="aprobar"><AprobacionesPage /></ProtectedRoute>} />
                <Route path="/compras/solicitudes" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><SolicitudesListPage /></ProtectedRoute>} />
                <Route path="/compras/solicitudes/nueva" element={<ProtectedRoute modulo="ordenes_compra" accion="crear"><SolicitudFormPage /></ProtectedRoute>} />
                <Route path="/compras/solicitudes/:id/editar" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><SolicitudFormPage /></ProtectedRoute>} />
                <Route path="/compras/cotizaciones/comparativa/:solicitudId" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><ComparacionCotizacionesPage /></ProtectedRoute>} />
                <Route path="/compras/oc" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><OrdenesCompraPage /></ProtectedRoute>} />
                <Route path="/compras/oc/:id/editar" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><OrdenCompraFormPage /></ProtectedRoute>} />
                <Route path="/compras/recepcion/:id" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><RecepcionMercanciaPage /></ProtectedRoute>} />
                
                {/* Comercial */}
                <Route path="/contacts" element={<ProtectedRoute modulo="contactos" accion="ver"><ContactsPage /></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute modulo="pipeline" accion="ver"><PipelinePage /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute modulo="tareas" accion="ver"><TasksPage /></ProtectedRoute>} />
                <Route path="/quotes" element={<ProtectedRoute modulo="cotizaciones" accion="ver"><QuotesPage /></ProtectedRoute>} />

                {/* Marketing */}
                <Route path="/leads" element={<ProtectedRoute modulo="leads" accion="ver"><LeadsPage /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute modulo="campanas" accion="ver"><CampaignsPage /></ProtectedRoute>} />

                {/* Operaciones */}
                <Route path="/support" element={<ProtectedRoute modulo="soporte" accion="ver"><SupportPage /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute modulo="empleados" accion="ver"><EmployeesPage /></ProtectedRoute>} />
                <Route path="/equipos" element={<ProtectedRoute modulo="equipos" accion="ver"><EquiposPage /></ProtectedRoute>} />
                <Route path="/turnos" element={<ProtectedRoute modulo="turnos" accion="ver"><TurnoPage /></ProtectedRoute>} />
                <Route path="/turnos/supervisor" element={<ProtectedRoute modulo="turnos" accion="ver"><TurnoSupervisorPage /></ProtectedRoute>} />

                {/* Servicios / Remisiones */}
                <Route path="/catalogo-servicios" element={<ProtectedRoute><CatalogoServiciosPage /></ProtectedRoute>} />
                <Route path="/servicios" element={<ProtectedRoute><ServiciosPage /></ProtectedRoute>} />
                <Route path="/servicios/nueva" element={<ProtectedRoute><RemisionFormPage /></ProtectedRoute>} />
                <Route path="/servicios/:id" element={<ProtectedRoute><RemisionDetailPage /></ProtectedRoute>} />
                <Route path="/servicios/:id/editar" element={<ProtectedRoute><RemisionFormPage /></ProtectedRoute>} />

                {/* Facturación */}
                <Route path="/facturacion" element={<ProtectedRoute modulo="facturacion" accion="ver"><FacturacionDashboard /></ProtectedRoute>} />
                <Route path="/facturacion/pendientes" element={<ProtectedRoute modulo="facturacion" accion="ver"><OtsPendientesPage /></ProtectedRoute>} />
                <Route path="/facturacion/facturas" element={<ProtectedRoute modulo="facturacion" accion="ver"><FacturasListPage /></ProtectedRoute>} />
                <Route path="/facturacion/facturas/:id" element={<ProtectedRoute modulo="facturacion" accion="ver"><FacturaDetailPage /></ProtectedRoute>} />

                {/* Logística */}
                <Route path="/proveedores" element={<ProtectedRoute modulo="proveedores" accion="ver"><ProveedoresListPage /></ProtectedRoute>} />
                <Route path="/proveedores/nuevo" element={<ProtectedRoute modulo="proveedores" accion="crear"><ProveedorFormPage /></ProtectedRoute>} />
                <Route path="/proveedores/:id" element={<ProtectedRoute modulo="proveedores" accion="ver"><ProveedorFichaPage /></ProtectedRoute>} />

                {/* Analítica / BI */}
                
                <Route path="/reportes/servicios" element={<ProtectedRoute><SalesReportServicios /></ProtectedRoute>} />
                <Route path="/reportes/mantenimiento" element={<ProtectedRoute><SalesReportMantenimiento /></ProtectedRoute>} />

                {/* Informes Nuevos */}
                <Route path="/informes" element={<ProtectedRoute><InformesIndexPage /></ProtectedRoute>} />
                <Route path="/informes/servicios" element={<ProtectedRoute><InformesServiciosPage /></ProtectedRoute>} />
                <Route path="/informes/mantenimiento" element={<ProtectedRoute><InformesMantenimientoPage /></ProtectedRoute>} />
                <Route path="/informes/gestion-humana" element={<ProtectedRoute><InformesGestionHumanaPage /></ProtectedRoute>} />

                {/* Presupuestos */}
                <Route path="/presupuestos" element={<ProtectedRoute><BudgetIndexPage /></ProtectedRoute>} />
                <Route path="/presupuestos/area/:areaId" element={<ProtectedRoute><BudgetFormPage /></ProtectedRoute>} />

                {/* Perfil */}
                <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                {/* Programación de Mantenimientos */}
                <Route path="/mantenimientos-programados/*" element={<ProtectedRoute><MantenimientosProgramados /></ProtectedRoute>} />

                {/* Sistemas */}
                <Route path="/sistemas/generador-prompts" element={<ProtectedRoute adminOnly><PromptGeneratorPage /></ProtectedRoute>} />

                {/* Admin Usuarios */}
                <Route path="/admin/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
                <Route path="/admin/backups" element={<ProtectedRoute adminOnly><BackupsPage /></ProtectedRoute>} />

                {/* Redirect raíz */}
                <Route path="/403" element={<Error403Page />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
              </div>
            </div>
            </ErrorBoundary>
          </BrowserRouter>
        </PermissionsProvider>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
          }}
        />
      </QueryClientProvider>
    
  );
}

export default App;
