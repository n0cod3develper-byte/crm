import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  LayoutDashboard,
  Wrench,
  Package,
  ShoppingCart,
  Receipt,
  Truck,
  Toolbox,
  Shield,
} from 'lucide-react';
import { ProtectedRoute } from './auth/ProtectedRoute';

// ─── Contextos de módulos ─────────────────────────────────────
export const MODULE_CONTEXT = {
  dashboard: {
    title: 'Dashboard',
    message: 'Error al cargar el panel principal',
    icon: <LayoutDashboard size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  mantenimiento: {
    title: 'Mantenimiento',
    message: 'Error al cargar el modulo de mantenimiento',
    icon: <Wrench size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  inventario: {
    title: 'Inventario / Catalogo',
    message: 'Error al cargar el modulo de inventario',
    icon: <Package size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  compras: {
    title: 'Compras',
    message: 'Error al cargar el modulo de compras',
    icon: <ShoppingCart size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  facturacion: {
    title: 'Facturacion',
    message: 'Error al cargar el modulo de facturacion',
    icon: <Receipt size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  proveedores: {
    title: 'Proveedores',
    message: 'Error al cargar el modulo de proveedores',
    icon: <Truck size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  servicios: {
    title: 'Servicios',
    message: 'Error al cargar el modulo de servicios',
    icon: <Toolbox size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
  admin: {
    title: 'Administracion',
    message: 'Error al cargar el modulo de administracion',
    icon: <Shield size={36} style={{ color: 'var(--clr-danger)' }} />,
  },
};

/**
 * Combina ProtectedRoute + ErrorBoundary contextual para un modulo.
 *
 * - `context`: clave del contexto visual (dashboard|mantenimiento|inventario|...)
 *   Si se omite, se usa el valor de `modulo` como contexto.
 * - `modulo`, `accion`, `adminOnly`: se pasan directamente a ProtectedRoute
 *
 * Uso:
 *   <SafeModule context="dashboard"><DashboardPage /></SafeModule>
 *   <SafeModule context="mantenimiento" modulo="ordenes_trabajo"><OTFormPage /></SafeModule>
 *   <SafeModule context="inventario" modulo="catalogo"><CatalogListPage /></SafeModule>
 */
export function SafeModule({ modulo, accion, adminOnly, context, children }) {
  const ctxKey = context || modulo;
  const ctx = MODULE_CONTEXT[ctxKey] || {};

  return (
    <ProtectedRoute modulo={modulo} accion={accion} adminOnly={adminOnly}>
      <ErrorBoundary contextIcon={ctx.icon} contextTitle={ctx.title} contextMessage={ctx.message}>
        {children}
      </ErrorBoundary>
    </ProtectedRoute>
  );
}

// ─── ErrorBoundary ────────────────────────────────────────────
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Error capturado:', error);
    console.error('[ErrorBoundary] Stack:', errorInfo?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, showDetails } = this.state;
    const { contextTitle, contextMessage, contextIcon } = this.props;
    const isDev = import.meta.env.DEV;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        padding: '2rem',
        fontFamily: 'var(--font-sans)',
      }}>
        <div className="card" style={{
          width: '100%',
          maxWidth: '520px',
          padding: '2.5rem',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}>
            {contextIcon || <AlertTriangle size={36} style={{ color: 'var(--clr-danger)' }} />}
          </div>

          {contextTitle && (
            <p style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: '0.25rem',
            }}>
              {contextTitle}
            </p>
          )}

          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}>
            {contextMessage || 'Algo salio mal'}
          </h1>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
            lineHeight: 1.6,
          }}>
            {contextTitle
              ? `Ocurrio un error al cargar el modulo de ${contextTitle.toLowerCase()}. Puedes intentar recargar o volver al inicio.`
              : 'Ocurrio un error inesperado al cargar esta seccion. Puedes intentar recargar la pagina o volver al inicio.'
            }
          </p>

          {isDev && error && (
            <p style={{
              color: 'var(--clr-danger)',
              fontSize: '0.8rem',
              fontWeight: 500,
              marginBottom: '1.5rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
            }}>
              {error.name}: {error.message}
            </p>
          )}

          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '0.5rem',
          }}>
            <button
              onClick={this.handleRetry}
              className="btn btn--primary"
              style={{ padding: '0.625rem 1.25rem' }}
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
            <button
              onClick={this.handleGoHome}
              className="btn btn--secondary"
              style={{ padding: '0.625rem 1.25rem' }}
            >
              <Home size={16} />
              Ir al inicio
            </button>
          </div>

          {isDev && (
            <div style={{ marginTop: '2rem' }}>
              <button
                onClick={this.toggleDetails}
                className="btn btn--ghost btn--sm"
                style={{ fontSize: '0.75rem' }}
              >
                <Bug size={14} />
                {showDetails ? 'Ocultar detalles' : 'Ver detalles tecnicos'}
              </button>

              {showDetails && errorInfo && (
                <pre style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'left',
                  overflowX: 'auto',
                  color: 'var(--text-secondary)',
                  maxHeight: '300px',
                  lineHeight: 1.5,
                }}>
                  {error?.stack}
                  {'\n\n'}
                  {errorInfo?.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
