import api from '../lib/api';

// Backups están montadas en /api/backups (fuera de /api/v1).
// En producción (VITE_API_URL definido) usamos el mismo origen que la API
// para que las cookies de autenticación se envíen correctamente.
// En desarrollo local usamos ruta relativa (pasa por proxy de Vite).
const BACKUP_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
  : '';

export const getBackupList = async () => {
  const { data } = await api.get('/api/backups/list', { baseURL: BACKUP_BASE });
  return data;
};

export const getBackupStatus = async () => {
  const { data } = await api.get('/api/backups/status', { baseURL: BACKUP_BASE });
  return data;
};

export const generateBackup = async () => {
  const { data } = await api.post('/api/backups/generate', {}, { baseURL: BACKUP_BASE });
  return data;
};

export const deleteBackup = async (filename) => {
  const { data } = await api.delete(`/api/backups/${filename}`, { baseURL: BACKUP_BASE });
  return data;
};
