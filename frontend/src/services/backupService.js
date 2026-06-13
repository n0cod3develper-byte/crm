import api from '../lib/api';

// Backups están montadas en /api/backups (fuera de /api/v1) en el backend local.
// Usamos baseURL vacío para que la ruta completa /api/backups/* pase por el
// proxy de Vite (→ localhost:3005 → backend) y no haya problemas de CORS.
const BACKUP_BASE = '';

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
