import api from '../lib/api';

export const catalogApi = {
  getItems: (params) => api.get('/catalogo', { params }).then(res => res.data),
  getItem: (id) => api.get(`/catalogo/${id}`).then(res => res.data),
  buscar: (q, tipo, limit = 10) => api.get('/catalogo/buscar', { params: { q, tipo, limit } }).then(res => res.data),
  getAlertas: () => api.get('/catalogo/alertas').then(res => res.data),
  getCategorias: () => api.get('/catalogo/categorias').then(res => res.data),
  createCategoria: (data) => api.post('/catalogo/categorias', data).then(res => res.data),
  updateCategoria: (id, data) => api.put(`/catalogo/categorias/${id}`, data).then(res => res.data),
  deleteCategoria: (id) => api.delete(`/catalogo/categorias/${id}`).then(res => res.data),
  adjustStock: (id, body) => api.patch(`/catalogo/${id}/stock`, body).then(res => res.data),
  getUnidades: () => api.get('/catalogo/unidades').then(res => res.data),
  create: (data) => api.post('/catalogo', data).then(res => res.data),
  update: (id, data) => api.put(`/catalogo/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/catalogo/${id}`).then(res => res.data),
  uploadImagen: (id, formData) => api.post(`/catalogo/${id}/imagen`, formData, {
    headers: { 'Content-Type': undefined }
  }).then(res => res.data),
  // Ubicaciones
  getUbicaciones: (params) => api.get('/ubicaciones', { params }).then(r => r.data),
  getUbicacionStats: () => api.get('/ubicaciones/stats').then(r => r.data),
  createUbicacion: (data) => api.post('/ubicaciones', data).then(r => r.data),
  updateUbicacion: (id, data) => api.put(`/ubicaciones/${id}`, data).then(r => r.data),
  deleteUbicacion: (id) => api.delete(`/ubicaciones/${id}`).then(r => r.data),
  // Prefijos
  getUbicacionesPrefijos: () => api.get('/ubicaciones/prefijos').then(r => r.data),
  createPrefijo: (data) => api.post('/ubicaciones/prefijos', data).then(r => r.data),
  updatePrefijo: (id, data) => api.put(`/ubicaciones/prefijos/${id}`, data).then(r => r.data),
  deletePrefijo: (id) => api.delete(`/ubicaciones/prefijos/${id}`).then(r => r.data),
  // Niveles
  getUbicacionesNiveles: () => api.get('/ubicaciones/niveles').then(r => r.data),
  createNivel: (data) => api.post('/ubicaciones/niveles', data).then(r => r.data),
  updateNivel: (id, data) => api.put(`/ubicaciones/niveles/${id}`, data).then(r => r.data),
  deleteNivel: (id) => api.delete(`/ubicaciones/niveles/${id}`).then(r => r.data),
};
