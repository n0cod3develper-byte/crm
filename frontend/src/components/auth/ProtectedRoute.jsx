import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function ProtectedRoute({ children, adminOnly, modulo, accion }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin bypass
  if (adminOnly && user.rol_slug !== 'admin' && user.rol_slug !== 'superadmin') {
    return <Navigate to="/unauthorized" replace />;
  }

  // Permission check: backend now returns an object keyed by modulo
  if (modulo && accion) {
    const modulePerms = user.permisos?.[modulo];
    const hasPermission = modulePerms && modulePerms[accion] === true;
    if (!hasPermission && user.rol_slug !== 'admin' && user.rol_slug !== 'superadmin') {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}
