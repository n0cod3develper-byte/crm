import { Router } from 'express';
import {
  registrarCompra,
  buscarProductos,
  getProductoInfoCompra,
  getHistorialCompras,
  getHistorialPreciosProducto,
  getOrdenesCompraLegacy,
  getOrdenCompraLegacyById
} from './compras.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── Rutas del Nuevo Módulo de Registro Simple de Compras ─────────
router.post('/registro', registrarCompra);
router.get('/productos/buscar', buscarProductos);
router.get('/productos/:id/info-compra', getProductoInfoCompra);
router.get('/productos/:id/historial-precios', getHistorialPreciosProducto);
router.get('/historial', getHistorialCompras);

// ── Rutas Legacy de Consulta Histórica de Órdenes de Compra ─────
router.get('/oc', getOrdenesCompraLegacy);
router.get('/oc/:id', getOrdenCompraLegacyById);

export default router;
