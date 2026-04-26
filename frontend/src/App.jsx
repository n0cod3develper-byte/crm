import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';

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
const PMAdminPage = lazy(() => import('./pages/Mantenimiento/PMAdminPage').then(m => ({ default: m.PMAdminPage })));

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
const RolesPage = lazy(() => import('./pages/Admin/RolesPage').then(m => ({ default: m.RolesPage })));
const UsersPage = lazy(() => import('./pages/Admin/UsersPage').then(m => ({ default: m.UsersPage })));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // datos frescos por 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { useThemeStore } from './stores/themeStore';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

const PageLoader = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
    <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
  </div>
);

function App() {
  const applyTheme = useThemeStore(s => s.applyTheme);

  React.useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsProvider>
        <BrowserRouter basename={import.meta.env.PROD ? '/crm' : '/'}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Rutas protegidas */}
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />
            <Route path="/companies" element={
              <ProtectedRoute modulo="empresas" accion="ver"><CompaniesPage /></ProtectedRoute>
            } />
            <Route path="/companies/:id" element={
              <ProtectedRoute modulo="empresas" accion="ver"><CompanyDetailPage /></ProtectedRoute>
            } />
            <Route path="/inventory" element={
              <ProtectedRoute modulo="inventario" accion="ver"><InventoryPage /></ProtectedRoute>
            } />
            <Route path="/mantenimiento" element={
              <ProtectedRoute modulo="ordenes_trabajo" accion="ver"><MantenimientoPage /></ProtectedRoute>
            } />
            <Route path="/mantenimiento/nueva" element={
              <ProtectedRoute modulo="ordenes_trabajo" accion="crear"><OTFormPage /></ProtectedRoute>
            } />
            <Route path="/mantenimiento/configuracion" element={
              <ProtectedRoute adminOnly><PMAdminPage /></ProtectedRoute>
            } />
            <Route path="/mantenimiento/:id/editar" element={
              <ProtectedRoute modulo="ordenes_trabajo" accion="editar"><OTFormPage /></ProtectedRoute>
            } />
            <Route path="/mantenimiento/:id" element={
              <ProtectedRoute modulo="ordenes_trabajo" accion="ver"><OTDetailPage /></ProtectedRoute>
            } />
            <Route path="/admin/roles" element={
              <ProtectedRoute adminOnly><RolesPage /></ProtectedRoute>
            } />
            <Route path="/admin/usuarios" element={
              <ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>
            } />

            {/* Módulo Compras — Dashboard */}
            <Route path="/compras" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><DashboardComprasPage /></ProtectedRoute>} />
            <Route path="/compras/aprobaciones" element={<ProtectedRoute modulo="ordenes_compra" accion="aprobar"><AprobacionesPage /></ProtectedRoute>} />

            {/* Compras — Solicitudes */}
            <Route path="/compras/solicitudes" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><SolicitudesListPage /></ProtectedRoute>} />
            <Route path="/compras/solicitudes/nueva" element={<ProtectedRoute modulo="ordenes_compra" accion="crear"><SolicitudFormPage /></ProtectedRoute>} />
            <Route path="/compras/solicitudes/:id/editar" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><SolicitudFormPage /></ProtectedRoute>} />

            {/* Compras — Comparativa de Cotizaciones */}
            <Route path="/compras/cotizaciones/comparativa/:solicitudId" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><ComparacionCotizacionesPage /></ProtectedRoute>} />

            {/* Compras — Órdenes de Compra */}
            <Route path="/compras/oc" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><OrdenesCompraPage /></ProtectedRoute>} />
            <Route path="/compras/oc/:id/editar" element={<ProtectedRoute modulo="ordenes_compra" accion="ver"><OrdenCompraFormPage /></ProtectedRoute>} />

            {/* Compras — Recepción de Mercancía */}
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

            {/* Logística */}
            <Route path="/proveedores" element={<ProtectedRoute modulo="proveedores" accion="ver"><ProveedoresListPage /></ProtectedRoute>} />
            <Route path="/proveedores/nuevo" element={<ProtectedRoute modulo="proveedores" accion="crear"><ProveedorFormPage /></ProtectedRoute>} />
            <Route path="/proveedores/:id" element={<ProtectedRoute modulo="proveedores" accion="ver"><ProveedorFichaPage /></ProtectedRoute>} />

            {/* Admin Usuarios */}
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />


            {/* Redirect raíz */}
            <Route path="/403" element={<Error403Page />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
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
