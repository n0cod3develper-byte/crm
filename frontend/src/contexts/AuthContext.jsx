import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include'
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const result = await res.json();
      if (res.ok) {
        await fetchUser();
        toast.success('Sesión iniciada');
        return { success: true };
      } else {
        const errorMsg = result.error?.message || result.error || 'Credenciales inválidas';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      toast.error('Error de conexión');
      return { success: false, error: 'Error de conexión' };
    }
  }

  async function register(data) {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok) {
        // Recargar datos del usuario
        await fetchUser();
        toast.success('Cuenta creada correctamente');
        return true;
      } else {
        toast.error(result.error?.message || result.error || 'Error al registrarse');
        return false;
      }
    } catch (err) {
      toast.error('Error de conexión');
      return false;
    }
  }

  async function logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      // Ignorar errores de logout
    }
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
