import api from '../lib/api';

export const facturacionApi = {
  // Consultas
  getOtsPendientes: (params) => api.get('/facturacion/ots-pendientes', { params }).then(res => res.data),
  getRemisionesPendientes: (params) => api.get('/facturacion/remisiones-pendientes', { params }).then(res => res.data),
  getResumenCartera: () => api.get('/facturacion/cartera').then(res => res.data),
  getFacturas: (params) => api.get('/facturacion/facturas', { params }).then(res => res.data),
  getFactura: (id) => api.get('/facturacion/facturas/' + id).then(res => res.data),
  
  // PDF
  getFacturaPdfUrl: (id) => `${import.meta.env.VITE_API_URL}/api/v1/facturacion/facturas/${id}/pdf`,
  downloadFacturaPdf: (id) => api.get(`/facturacion/facturas/${id}/pdf`, { responseType: 'blob' }),

  // Acciones
  createPrefactura: (data) => api.post('/facturacion/prefacturas', data).then(res => res.data),
  createPrefacturaFromRemisiones: (data) => api.post('/facturacion/prefacturas-remision', data).then(res => res.data),
  updateFactura: (id, data) => api.put(`/facturacion/facturas/${id}`, data).then(res => res.data),
  updateFacturaFields: (id, data) => api.patch(`/facturacion/facturas/${id}/campos`, data).then(res => res.data),
  confirmarFactura: (id, data) => api.post(`/facturacion/facturas/${id}/confirmar`, data).then(res => res.data),
  anularFactura: (id, motivo) => api.post(`/facturacion/facturas/${id}/anular`, { motivo }).then(res => res.data),
};
