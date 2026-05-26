import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Enviar cookies automáticamente
});

// ─── Response interceptor: refresca el token si expira ───
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => error ? prom.reject(error) : prom.resolve());
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // ─── Normalizar formato de error ───────────────────────────
    // El backend inconsistemente devuelve error como string
    // (TURNO_CERRADO) o como objeto { message: ... } (AppError).
    // Normalizamos para que todos los componentes reciban string.
    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data.error === 'object' && data.error !== null && data.error?.message) {
        // { error: { message: '...' } } → { error: '...', message: '...' }
        data.message = data.error.message;
        data.error = data.error.message;
      }
    }

    const originalRequest = error.config;

    // Si recibimos 401 y no es un reintento
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // El refresh token se envía automáticamente via cookie httpOnly
        await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Si falla el refresh, redirigir al login (las cookies se limpian solas)
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
