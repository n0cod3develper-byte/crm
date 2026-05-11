import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const { user, token, loading: authLoading } = useAuth();
  const [data, setData] = useState({ rol: null, permisos: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPermissions() {
      if (authLoading) return;
      
      if (!token || !user) {
        setData({ rol: null, permisos: {} });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
        const response = await fetch(`${API_URL}/me/permisos`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          setData({ rol: result.rol, permisos: result.permisos });
        } else {
          setData({ rol: null, permisos: {} });
        }
      } catch (err) {
        console.error('Error in PermissionsProvider:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [authLoading, token, user]);

  const puede = (modulo, accion) => {
    if (data.rol?.slug === 'admin') return true;
    return data.permisos[modulo]?.[accion] === true;
  };

  const esAdmin = () => data.rol?.slug === 'admin';

  const value = {
    rolActual: data.rol,
    permisos: data.permisos,
    puede,
    esAdmin,
    loading: loading || authLoading,
    error,
    refreshPermissions: async () => {}
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions debe usarse dentro de un PermissionsProvider');
  }
  return context;
}
