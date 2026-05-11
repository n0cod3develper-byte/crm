import React from 'react';
import { usePermissions } from '../../contexts/PermissionsContext';

/**
 * Renderiza children solo si el usuario tiene el permiso.
 */
export function PermissionGuard({ modulo, accion, fallback = null, children }) {
  const { puede, loading } = usePermissions();

  if (loading) return null; // Evitar flicker

  if (!puede(modulo, accion)) {
    return fallback;
  }

  return children;
}
