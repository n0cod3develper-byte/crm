import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken]   = useState(
    () => useAuthStore.getState().accessToken || localStorage.getItem('token')
  );

  // Sincroniza el token al authStore y localStorage
  function _syncToken(accessToken, refreshToken) {
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      useAuthStore.getState().setTokens(accessToken, refreshToken || '');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      useAuthStore.getState().logout();
    }
    setToken(accessToken);
  }

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  async function fetchUser() {
    try {
      // Usamos la instancia de axios 'api' que ya maneja el baseURL y el token
      const res = await api.get('/auth/me');
      const userData = res.data;
      setUser(userData);
      useAuthStore.getState().setUser(userData);
    } catch (err) {
      console.error('Error fetching user:', err);
      // Solo desincronizar si es un error de autenticación (401)
      if (err.response?.status === 401) {
        _syncToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      const res = await api.post('/auth/login', { email, password });
      const result = res.data;
      
      _syncToken(result.data.accessToken, result.data.refreshToken);
      setUser(result.data.user);
      useAuthStore.getState().setUser(result.data.user);
      toast.success('Sesión iniciada');
      return true;
    } catch (err) {
      const errorData = err.response?.data;
      const errMsg = typeof errorData?.error === 'string'
        ? errorData.error
        : errorData?.error?.message || errorData?.message || 'Credenciales inválidas';
      
      toast.error(errMsg);
      return false;
    }
  }

  async function register(data) {
    try {
      const res = await api.post('/auth/register', data);
      const result = res.data;
      
      _syncToken(result.data.accessToken, result.data.refreshToken);
      toast.success('Cuenta creada correctamente');
      return true;
    } catch (err) {
      const errorData = err.response?.data;
      const errMsg = typeof errorData?.error === 'string'
        ? errorData.error
        : errorData?.error?.message || errorData?.message || 'Error al registrarse';
      
      toast.error(errMsg);
      return false;
    }
  }

  function logout() {
    _syncToken(null);
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
