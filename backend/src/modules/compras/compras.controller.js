import { comprasRepository } from './compras.repository.js';
import { comprasService } from './compras.service.js';
import { db } from '../../config/database.js';
import { generarPDFOrdenCompra } from './compras.pdf.js';

export const getSolicitudes = async (req, res) => {
  try {
    const result = await comprasRepository.getSolicitudes(req.query);
    res.json({ data: result });
  } catch (e) {
    console.error('Error getSolicitudes:', e);
    res.status(500).json({ error: e.message });
  }
};

export const getSolicitudById = async (req, res) => {
  try {
    const result = await comprasRepository.getSolicitudById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ data: result });
  } catch (e) {
    console.error('Error getSolicitudById:', e);
    res.status(500).json({ error: e.message });
  }
};

export const createSolicitud = async (req, res) => {
  try {
    const solicitud = await comprasService.crearSolicitud(req.body, req.user.id);
    res.status(201).json({ data: solicitud });
  } catch(e) {
    console.error('Error createSolicitud:', e);
    res.status(500).json({ error: e.message });
  }
};

export const updateSolicitud = async (req, res) => {
  try {
    const result = await comprasService.actualizarSolicitud(req.params.id, req.body, req.user.id);
    res.json({ data: result });
  } catch(e) {
    console.error('Error updateSolicitud:', e);
    res.status(500).json({ error: e.message });
  }
};

export const enviarSolicitud = async (req, res) => {
  try {
    await comprasRepository.setSolicitudStatus(req.params.id, 'EN_COTIZACION');
    res.json({ success: true });
  } catch (e) {
    console.error('Error enviarSolicitud:', e);
    res.status(500).json({ error: e.message });
  }
};

export const getCotizaciones = async (req, res) => {
  try {
    const result = await comprasRepository.getCotizacionesBySolicitud(req.params.id);
    res.json({ data: result });
  } catch (e) {
    console.error('Error getCotizaciones:', e);
    res.status(500).json({ error: e.message });
  }
};

export const createCotizacion = async (req, res) => {
  try {
    const cotizacion = await comprasService.registrarCotizacion(req.params.id, req.body);
    res.status(201).json({ data: cotizacion });
  } catch(e) {
    console.error('Error createCotizacion:', e);
    res.status(500).json({ error: e.message });
  }
};

export const selectCotizacion = async (req, res) => {
  try {
    const ocId = await comprasService.generarOcDesdeCotizacion(req.params.id, req.user.id);
    res.json({ data: { id: ocId }, success: true });
  } catch(e) {
    console.error('Error selectCotizacion:', e);
    res.status(500).json({ error: e.message });
  }
};

export const getOrdenesCompra = async (req, res) => {
  try {
    const result = await comprasRepository.getOrdenesCompra(req.query);
    res.json({ data: result });
  } catch (e) {
    console.error('Error getOrdenesCompra:', e);
    res.status(500).json({ error: e.message });
  }
};

export const getOrdenCompra = async (req, res) => {
  try {
    const result = await comprasRepository.getOrdenCompraById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Orden de compra no encontrada' });
    res.json({ data: result });
  } catch (e) {
    console.error('Error getOrdenCompra:', e);
    res.status(500).json({ error: e.message });
  }
};

export const enviarParaAprobacion = async (req, res) => {
  try {
    await db.query("UPDATE ordenes_compra SET estado = 'EN_APROBACION', updated_at = NOW() WHERE id = $1 AND estado = 'BORRADOR'", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error enviarParaAprobacion:', e);
    res.status(500).json({ error: e.message });
  }
};

export const aprobarOc = async (req, res) => {
  try {
    await comprasService.procesarAprobacion(req.params.id, 'APROBAR', req.user.id, req.body.comentario);
    res.json({ success: true });
  } catch(e) {
    console.error('Error aprobarOc:', e);
    res.status(500).json({ error: e.message });
  }
};

export const rechazarOc = async (req, res) => {
  try {
    await comprasService.procesarAprobacion(req.params.id, 'RECHAZAR', req.user.id, req.body.comentario);
    res.json({ success: true });
  } catch(e) {
    console.error('Error rechazarOc:', e);
    res.status(500).json({ error: e.message });
  }
};

export const emitirOc = async (req, res) => {
  try {
    await db.query("UPDATE ordenes_compra SET estado = 'EMITIDA', updated_at = NOW() WHERE id = $1 AND estado = 'APROBADA'", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error emitirOc:', e);
    res.status(500).json({ error: e.message });
  }
};

export const recibirOc = async (req, res) => {
  try {
    await comprasService.recibirMercancia(req.params.id, req.body, req.user.id);
    res.json({ success: true });
  } catch(e) {
    console.error('Error recibirOc:', e);
    res.status(500).json({ error: e.message });
  }
};

export const getPdfOc = async (req, res) => {
  try {
    const pdfBuffer = await generarPDFOrdenCompra(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="OC-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error PDF:', error);
    res.status(500).json({ error: error.message });
  }
};
