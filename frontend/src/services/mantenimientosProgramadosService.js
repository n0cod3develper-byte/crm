import api from '../lib/api';

const BASE = '/mantenimientos-programados';

export const mpService = {
  // Planes
  getPlanes:          (params)  => api.get(`${BASE}/planes`, { params }),
  getPlan:            (id)      => api.get(`${BASE}/planes/${id}`),
  createPlan:         (data)    => api.post(`${BASE}/planes`, data),
  updatePlan:         (id,data) => api.put(`${BASE}/planes/${id}`, data),
  togglePlan:         (id)      => api.patch(`${BASE}/planes/${id}/toggle`),
  deletePlan:         (id)      => api.delete(`${BASE}/planes/${id}`),
  generarOrden:       (id)      => api.post(`${BASE}/planes/${id}/generar-orden`),

  // Órdenes
  getOrdenes:         (params)  => api.get(`${BASE}/ordenes`, { params }),
  getOrden:           (id)      => api.get(`${BASE}/ordenes/${id}`),
  createOrden:        (data)    => api.post(`${BASE}/ordenes`, data),
  updateOrden:        (id,data) => api.put(`${BASE}/ordenes/${id}`, data),
  cambiarEstado:      (id,data) => api.patch(`${BASE}/ordenes/${id}/estado`, data),
  completarActividad: (id,actId,d) => api.patch(`${BASE}/ordenes/${id}/actividades/${actId}`, d),
  subirEvidencia:     (id,fd)   => api.post(`${BASE}/ordenes/${id}/evidencias`, fd, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                  }),
  eliminarEvidencia:  (id,evId) => api.delete(`${BASE}/ordenes/${id}/evidencias/${evId}`),
  getBitacora:        (id)      => api.get(`${BASE}/ordenes/${id}/bitacora`),

  // Calendario e Historial
  getCalendario:      (year,month) => api.get(`${BASE}/calendario`, { params: { year, month } }),
  getHistorialEquipo: (id)        => api.get(`${BASE}/historial/equipo/${id}`),
  getHistorialArea:   (id)        => api.get(`${BASE}/historial/area/${id}`),
  getKpis:            ()          => api.get(`${BASE}/dashboard/kpis`),
};
