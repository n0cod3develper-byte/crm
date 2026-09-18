import { comprasService } from './compras.service.js';
import { logger } from '../../utils/logger.js';

export const registrarCompra = async (req, res) => {
  try {
    const userId = req.auth?.userId || req.user?.id || 'sistema';
    const resultado = await comprasService.registrarCompra(req.body, userId);
    return res.status(201).json({
      success: true,
      message: 'Compra registrada e inventario actualizado exitosamente',
      data: resultado
    });
  } catch (error) {
    logger.error('Error en registrarCompra controller:', { error: error.message });
    return res.status(400).json({
      success: false,
      message: error.message || 'Error al procesar el registro de compra'
    });
  }
};

export const buscarProductos = async (req, res) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const productos = await comprasService.buscarProductos(q, limit);
    return res.json({
      success: true,
      data: productos
    });
  } catch (error) {
    logger.error('Error en buscarProductos controller:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar productos'
    });
  }
};

export const getProductoInfoCompra = async (req, res) => {
  try {
    const { id } = req.params;
    const info = await comprasService.getProductoInfoCompra(id);
    if (!info) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    return res.json({
      success: true,
      data: info
    });
  } catch (error) {
    logger.error('Error en getProductoInfoCompra controller:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener información del producto'
    });
  }
};

export const getHistorialCompras = async (req, res) => {
  try {
    const { page, limit, search, proveedor_id, producto_id, fecha_desde, fecha_hasta } = req.query;
    const data = await comprasService.getHistorialCompras({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      proveedorId: proveedor_id,
      productoId: producto_id,
      fechaDesde: fecha_desde,
      fechaHasta: fecha_hasta
    });
    return res.json({
      success: true,
      ...data
    });
  } catch (error) {
    logger.error('Error en getHistorialCompras controller:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al consultar historial de compras'
    });
  }
};

export const getHistorialPreciosProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const historial = await comprasService.getHistorialPreciosPorProducto(id);
    return res.json({
      success: true,
      data: historial
    });
  } catch (error) {
    logger.error('Error en getHistorialPreciosProducto controller:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al consultar historial de precios del producto'
    });
  }
};

/**
 * Endpoints Legacy de consulta histórica de OC
 */
export const getOrdenesCompraLegacy = async (req, res) => {
  try {
    const data = await comprasService.getOrdenesCompraLegacy();
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getOrdenCompraLegacyById = async (req, res) => {
  try {
    const data = await comprasService.getOrdenCompraLegacyById(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
