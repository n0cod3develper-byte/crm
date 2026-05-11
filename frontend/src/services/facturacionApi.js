import api from '../lib/api';

export const facturacionApi = {
  // Consultas
  getOtsPendientes: (params) => api.get('/facturacion/ots-pendientes', { params }).then(res => res.data),
  getResumenCartera: () => api.get('/facturacion/cartera').then(res => res.data),
  getFacturas: (params) => api.get('/facturacion/facturas', { params }).then(res => res.data),
  getFactura: (id) => api.get('/facturacion/facturas/' + id).then(res => res.data),
  
  // PDF
  getFacturaPdfUrl: (id) => `${import.meta.env.VITE_API_URL}/api/v1/facturacion/facturas/${id}/pdf`,

  // Acciones
  createPrefactura: (data) => api.post('/facturacion/prefacturas', data).then(res => res.data),
  confirmarFactura: (id, data) => api.post(`/facturacion/facturas/${id}/confirmar`, data).then(res => res.data),
  anularFactura: (id, motivo) => api.post(`/facturacion/facturas/${id}/anular`, { motivo }).then(res => res.data),
};
