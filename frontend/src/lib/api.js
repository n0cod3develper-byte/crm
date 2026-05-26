import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: adjunta el JWT y maneja FormData ─
api.interceptors.request.use((config) => {

  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Si el body es FormData, eliminar Content-Type para que el navegador
  // lo establezca automáticamente con el boundary multipart correcto.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }


  return config;
});

// ─── Response interceptor: refresca el token si expira ───
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';

    // No intentar refresh en rutas de auth (evitar loop en login fallido)
    const isAuthRoute = url.includes('/auth/login')
      || url.includes('/auth/register')
      || url.includes('/auth/refresh');

    // Si recibimos 401 y no es un reintento y no es ruta de auth
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data;
        
        localStorage.setItem('token', accessToken);
        localStorage.setItem('refreshToken', newRefresh);
        
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// 🔧 Normalize error messages: backend returns { error: { message } } but
// components read err.response.data.message — flatten so both paths work.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.data?.error?.message && !error.response.data.message) {
      error.response.data.message = error.response.data.error.message;
    }
    return Promise.reject(error);
  }
);

export default api;
