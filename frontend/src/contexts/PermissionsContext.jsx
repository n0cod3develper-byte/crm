import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const { user, token, loading: authLoading } = useAuth();
  const [data, setData] = useState({ rol: null, permisos: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPermissions() {
      if (authLoading) return;

      if (!token || !user) {
        setData({ rol: null, permisos: {} });
        setLoading(false);
        return;
      }

      // Si el usuario ya tiene rol/permisos en el objeto (vienen de /auth/me),
      // úsalos directamente sin hacer otra petición.
      if (user.rol || user.permisos) {
        setData({
          rol: user.rol || { slug: user.role, nombre: user.role },
          permisos: user.permisos || {},
        });
        setLoading(false);
        return;
      }

      // Fallback: intentar llamar al endpoint de permisos
      try {
        setLoading(true);
        const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
        const response = await fetch(`${API_URL}/me/permisos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const result = await response.json();
          setData({
            rol: result.rol || { slug: user.role, nombre: user.role },
            permisos: result.permisos || {},
          });
        } else {
          // Si falla, usar el role del usuario como fallback
          setData({ rol: { slug: user.role, nombre: user.role }, permisos: {} });
        }
      } catch {
        setData({ rol: { slug: user.role, nombre: user.role }, permisos: {} });
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [authLoading, token, user]);

  /**
   * Verifica si el usuario puede realizar una acción en un módulo.
   * Los admins siempre pueden todo.
   * Si no hay permisos granulares configurados, permite acceso (graceful degradation).
   */
  const puede = (modulo, accion) => {
    const rolSlug = data.rol?.slug;
    if (rolSlug === 'admin') return true;
    if (user?.role === 'admin') return true;
    // Si no hay permisos granulares, permitir acceso por defecto
    if (!data.rol || Object.keys(data.permisos).length === 0) return true;
    return data.permisos[modulo]?.[accion] === true;
  };

  const esAdmin = () => {
    return data.rol?.slug === 'admin' || user?.role === 'admin';
  };

  const value = {
    rolActual: data.rol,
    permisos: data.permisos,
    puede,
    esAdmin,
    loading: loading || authLoading,
    refreshPermissions: async () => {},
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions debe usarse dentro de un PermissionsProvider');
  return context;
}
