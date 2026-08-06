import api from '../lib/api';

export const emailMarketingApi = {
  // Listas
  getListas: (params) => api.get('/email-marketing/listas', { params }).then(res => res.data),
  getLista: (id) => api.get(`/email-marketing/listas/${id}`).then(res => res.data),
  createLista: (data) => api.post('/email-marketing/listas', data).then(res => res.data),
  updateLista: (id, data) => api.put(`/email-marketing/listas/${id}`, data).then(res => res.data),
  deleteLista: (id) => api.delete(`/email-marketing/listas/${id}`).then(res => res.data),
  getContactosDeLista: (id) => api.get(`/email-marketing/listas/${id}/contactos`).then(res => res.data),
  agregarContactoALista: (id, contacto_id) => api.post(`/email-marketing/listas/${id}/contactos`, { contacto_id }).then(res => res.data),
  quitarContactoDeLista: (id, contactoId) => api.delete(`/email-marketing/listas/${id}/contactos/${contactoId}`).then(res => res.data),
  importarContactos: (id, empresa_id) => api.post(`/email-marketing/listas/${id}/importar`, { empresa_id }).then(res => res.data),

  // Contactos
  getContactos: (params) => api.get('/email-marketing/contactos', { params }).then(res => res.data),
  getContacto: (id) => api.get(`/email-marketing/contactos/${id}`).then(res => res.data),
  createContacto: (data) => api.post('/email-marketing/contactos', data).then(res => res.data),
  updateContacto: (id, data) => api.put(`/email-marketing/contactos/${id}`, data).then(res => res.data),
  deleteContacto: (id) => api.delete(`/email-marketing/contactos/${id}`).then(res => res.data),

  // Plantillas
  getPlantillas: (params) => api.get('/email-marketing/plantillas', { params }).then(res => res.data),
  getPlantilla: (id) => api.get(`/email-marketing/plantillas/${id}`).then(res => res.data),
  createPlantilla: (data) => api.post('/email-marketing/plantillas', data).then(res => res.data),
  updatePlantilla: (id, data) => api.put(`/email-marketing/plantillas/${id}`, data).then(res => res.data),
  deletePlantilla: (id) => api.delete(`/email-marketing/plantillas/${id}`).then(res => res.data),

  // Campañas
  getCampanas: (params) => api.get('/email-marketing/campanas', { params }).then(res => res.data),
  getCampana: (id) => api.get(`/email-marketing/campanas/${id}`).then(res => res.data),
  createCampana: (data) => api.post('/email-marketing/campanas', data).then(res => res.data),
  updateCampana: (id, data) => api.put(`/email-marketing/campanas/${id}`, data).then(res => res.data),
  deleteCampana: (id) => api.delete(`/email-marketing/campanas/${id}`).then(res => res.data),
  enviarCampana: (id) => api.post(`/email-marketing/campanas/${id}/enviar`).then(res => res.data),
  cancelarCampana: (id) => api.post(`/email-marketing/campanas/${id}/cancelar`).then(res => res.data),
  enviarPruebaCampana: (id) => api.post(`/email-marketing/campanas/${id}/prueba`).then(res => res.data),
  getEnviosDeCampana: (id, params) => api.get(`/email-marketing/campanas/${id}/envios`, { params }).then(res => res.data),

  // Plantillas
  enviarPruebaPlantilla: (id) => api.post(`/email-marketing/plantillas/${id}/prueba`).then(res => res.data),

  // Reportes / BI
  getResumen: (params) => api.get('/informes/email-marketing/resumen', { params }).then(res => res.data),
  getTasasCampana: (params) => api.get('/informes/email-marketing/tasas-campana', { params }).then(res => res.data),
  getEvolucionListas: (params) => api.get('/informes/email-marketing/evolucion-listas', { params }).then(res => res.data),
  getRankingPlantillas: () => api.get('/informes/email-marketing/ranking-plantillas').then(res => res.data),
  getSaludLista: () => api.get('/informes/email-marketing/salud-lista').then(res => res.data),
  getComparativoCampanas: (params) => api.get('/informes/email-marketing/comparativo-campanas', { params }).then(res => res.data),
  getEvolucionMensual: (params) => api.get('/informes/email-marketing/evolucion-mensual', { params }).then(res => res.data),
};
