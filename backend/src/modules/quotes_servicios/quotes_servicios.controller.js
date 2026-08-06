import { QuotesServiciosRepository } from './quotes_servicios.repository.js';
import { generateQuoteServicioPDF } from './quotes_servicios.pdf.js';
import { v4 as uuidv4 } from 'uuid';

const repo = new QuotesServiciosRepository();

export async function getQuotes(req, res, next) {
  try {
    const { companyId, status, search, limit, cursor } = req.query;
    const result = await repo.findAll({ companyId, status, search, limit: parseInt(limit) || 50, cursor });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getQuote(req, res, next) {
  try {
    const quote = await repo.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) {
    next(err);
  }
}

export async function createQuote(req, res, next) {
  try {
    // Para simplificar, obtenemos userId de clerkAuth si existe (req.auth.userId), 
    // en este sistema CRM se usa req.user.id
    const userId = req.user?.id || null;
    const quote = await repo.create(req.body, userId);
    res.status(201).json({ message: 'Cotización creada', data: quote });
  } catch (err) {
    next(err);
  }
}

export async function updateQuote(req, res, next) {
  try {
    const quote = await repo.update(req.params.id, req.body);
    res.json({ message: 'Cotización actualizada', data: quote });
  } catch (err) {
    next(err);
  }
}

export async function updateQuoteStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'El estado es requerido' });
    const quote = await repo.updateStatus(req.params.id, status);
    res.json({ message: 'Estado actualizado', data: quote });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuote(req, res, next) {
  try {
    await repo.delete(req.params.id);
    res.json({ message: 'Cotización eliminada' });
  } catch (err) {
    next(err);
  }
}

export async function downloadPDF(req, res, next) {
  try {
    const quote = await repo.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Cotización no encontrada' });
    
    // Generamos el PDF (devolvemos un stream o buffer según tu implementación actual de pdf)
    const pdfBuffer = await generateQuoteServicioPDF(quote);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Cotizacion_Servicio_${quote.consecutivo}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
