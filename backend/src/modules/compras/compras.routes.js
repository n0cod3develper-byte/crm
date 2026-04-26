import { Router } from 'express';
import {
  getSolicitudes,
  getSolicitudById,
  createSolicitud,
  updateSolicitud,
  enviarSolicitud,
  getCotizaciones,
  createCotizacion,
  selectCotizacion,
  getOrdenesCompra,
  getOrdenCompra,
  enviarParaAprobacion,
  aprobarOc,
  rechazarOc,
  emitirOc,
  recibirOc,
  getPdfOc
} from './compras.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Solicitudes
router.get('/solicitudes', getSolicitudes);
router.get('/solicitudes/:id', getSolicitudById);
router.post('/solicitudes', createSolicitud);
router.put('/solicitudes/:id', updateSolicitud);
router.post('/solicitudes/:id/enviar', enviarSolicitud);
router.get('/solicitudes/:id/cotizaciones', getCotizaciones);
router.post('/solicitudes/:id/cotizaciones', createCotizacion);

// Cotizaciones
router.post('/cotizaciones/:id/seleccionar', selectCotizacion);

// Órdenes de Compra
router.get('/oc', getOrdenesCompra);
router.get('/oc/:id', getOrdenCompra);
router.post('/oc/:id/enviar-aprobacion', enviarParaAprobacion);
router.post('/oc/:id/aprobar', aprobarOc);
router.post('/oc/:id/rechazar', rechazarOc);
router.post('/oc/:id/emitir', emitirOc);
router.post('/oc/:id/recibir', recibirOc);
router.get('/oc/:id/pdf', getPdfOc);

export default router;
