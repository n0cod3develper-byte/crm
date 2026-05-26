import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';

/**
 * Ruta protegida.
 * - Sin token → redirige a /login
 * - adminOnly → solo accesible si esAdmin()
 * - modulo + accion → verifica permiso granular
 * - Sin props → solo requiere estar autenticado
 */
export function ProtectedRoute({ children, modulo, accion, adminOnly }) {
  const { token, loading } = useAuth();
  const { puede, esAdmin, loading: loadingPerms } = usePermissions();
  const location = useLocation();

  if (loading || loadingPerms) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !esAdmin()) {
    return <Navigate to="/403" replace />;
  }

  if (modulo && accion && !puede(modulo, accion)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
