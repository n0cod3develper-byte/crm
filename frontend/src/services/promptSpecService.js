import api from '../lib/api';

// Las rutas de prompt-specs estan montadas en /api/prompt-specs (fuera de /api/v1).
// En produccion (VITE_API_URL definido) usamos el mismo origen que la API.
// En desarrollo local usamos ruta relativa (pasa por proxy de Vite).
const PROMPT_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
  : '';

const BASE = '/api/prompt-specs';

export const promptSpecService = {
  /** POST /api/prompt-specs */
  create: (data) => api.post(BASE, data, { baseURL: PROMPT_BASE }).then((r) => r.data),

  /** GET /api/prompt-specs?page=&limit=&area=&search= */
  list: (params) => api.get(BASE, { params, baseURL: PROMPT_BASE }).then((r) => r.data),

  /** GET /api/prompt-specs/:id */
  getById: (id) => api.get(BASE + '/' + id, { baseURL: PROMPT_BASE }).then((r) => r.data),

  /** POST /api/prompt-specs/:id/clonar */
  clone: (id) => api.post(BASE + '/' + id + '/clonar', {}, { baseURL: PROMPT_BASE }).then((r) => r.data),

  /** DELETE /api/prompt-specs/:id */
  remove: (id) => api.delete(BASE + '/' + id, { baseURL: PROMPT_BASE }).then((r) => r.data),

  /** GET /api/prompt-specs/modulos */
  getModulos: () => api.get(BASE + '/modulos', { baseURL: PROMPT_BASE }).then((r) => r.data),
};
