import { FacturacionRepository } from './facturacion.repository.js';
import { generatePrefacturaPdf } from '../../utils/pdfGenerator.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new FacturacionRepository();

export const getOtsPendientes = async (req, res, next) => {
  try {
    const { empresa_id, search, limit, offset } = req.query;
    const ots = await repo.getOtsPendientes({ empresa_id, search, limit, offset });
    res.json({ success: true, data: ots });
  } catch (err) { next(err); }
};

export const getRemisionesPendientes = async (req, res, next) => {
  try {
    const { empresa_id, search, limit, offset } = req.query;
    const remisiones = await repo.getRemisionesPendientes({ empresa_id, search, limit, offset });
    res.json({ success: true, data: remisiones });
  } catch (err) { next(err); }
};

export const getResumenCartera = async (req, res, next) => {
  try {
    const resumen = await repo.getResumenCartera();
    res.json({ success: true, data: resumen });
  } catch (err) { next(err); }
};

export const getFacturas = async (req, res, next) => {
  try {
    const { estado, empresa_id, search, limit, offset } = req.query;
    const facturas = await repo.getFacturas({ estado, empresa_id, search, limit, offset });
    res.json({ success: true, data: facturas });
  } catch (err) { next(err); }
};

export const getFactura = async (req, res, next) => {
  try {
    const factura = await repo.getFacturaById(req.params.id);
    if (!factura) throw new NotFoundError('Factura');
    res.json({ success: true, data: factura });
  } catch (err) { next(err); }
};

export const createPrefactura = async (req, res, next) => {
  try {
    const factura = await repo.createPrefactura(req.body, req.user.id);
    res.status(201).json({ success: true, data: factura });
  } catch (err) { next(err); }
};

export const createPrefacturaFromRemisiones = async (req, res, next) => {
  try {
    const factura = await repo.createPrefacturaFromRemisiones(req.body, req.user.id);
    res.status(201).json({ success: true, data: factura });
  } catch (err) { next(err); }
};

export const confirmarFactura = async (req, res, next) => {
  try {
    const factura = await repo.confirmarFactura(req.params.id, req.body, req.user.id);
    res.json({ success: true, data: factura });
  } catch (err) { next(err); }
};

export const anularFactura = async (req, res, next) => {
  try {
    const { motivo } = req.body;
    await repo.anularFactura(req.params.id, motivo, req.user.id);
    res.json({ success: true, message: 'Factura anulada correctamente' });
  } catch (err) { next(err); }
};

export const downloadPDF = async (req, res, next) => {
  try {
    const factura = await repo.getFacturaById(req.params.id);
    if (!factura) throw new NotFoundError('Factura');

    const pdfBuffer = await generatePrefacturaPdf(factura);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${factura.consecutivo_interno}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};
