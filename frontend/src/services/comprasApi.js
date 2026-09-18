import api from '../lib/api';

export const comprasApi = {
  buscarProductos: async (q = '', limit = 20) => {
    const { data } = await api.get('/compras/productos/buscar', {
      params: { q, limit }
    });
    return data.data || [];
  },

  getProductoInfo: async (productoId) => {
    const { data } = await api.get(`/compras/productos/${productoId}/info-compra`);
    return data.data;
  },

  registrarCompra: async (payload) => {
    const { data } = await api.post('/compras/registro', payload);
    return data;
  },

  getHistorial: async (params = {}) => {
    const { data } = await api.get('/compras/historial', { params });
    return data;
  },

  getHistorialPrecios: async (productoId) => {
    const { data } = await api.get(`/compras/productos/${productoId}/historial-precios`);
    return data.data || [];
  },

  getProveedores: async () => {
    const { data } = await api.get('/proveedores');
    return (data.data || data) || [];
  }
};
