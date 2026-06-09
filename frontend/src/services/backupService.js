import api from '../lib/api';

// Usamos baseURL '/' porque en app.js configuramos la ruta explícitamente en /api/backups
// y no dentro de /api/v1/

export const getBackupList = async () => {
  const { data } = await api.get('/api/backups/list', { baseURL: '/' });
  return data;
};

export const getBackupStatus = async () => {
  const { data } = await api.get('/api/backups/status', { baseURL: '/' });
  return data;
};

export const generateBackup = async () => {
  const { data } = await api.post('/api/backups/generate', {}, { baseURL: '/' });
  return data;
};

export const deleteBackup = async (filename) => {
  const { data } = await api.delete(`/api/backups/${filename}`, { baseURL: '/' });
  return data;
};
