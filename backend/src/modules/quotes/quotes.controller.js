import { QuotesRepository } from './quotes.repository.js';
import { quotesService } from './quotes.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { generarPDFCotizacionCliente } from './quotes.pdf.js';

const repo = new QuotesRepository();

export const quotesController = {
  async list(req, res, next) {
    try {
      const { companyId, opportunityId, status, search, limit, cursor } = req.query;
      const result = await repo.findAll({ companyId, opportunityId, status, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async listSupplierQuotesPending(req, res, next) {
    try {
      const result = await repo.findSupplierQuotesPending();
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const quote = await repo.findById(req.params.id);
      if (!quote) throw new NotFoundError('Cotización');
      res.json({ success: true, data: quote });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      console.log('[QUOTES] Create payload:', JSON.stringify(req.body, null, 2));
      const quote = await quotesService.createQuote(req.body, req.user.id);
      res.status(201).json({ success: true, data: quote });
    } catch (err) {
      console.error('[QUOTES] Create error:', err.message, err.details, err.statusCode);
      import('fs').then(fs => fs.writeFileSync('last_422_error.json', JSON.stringify({ message: err.message, details: err.details, status: err.statusCode }, null, 2)));
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const quote = await quotesService.updateQuote(req.params.id, req.body, req.user.id);
      if (!quote) throw new NotFoundError('Cotización');
      res.json({ success: true, data: quote });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Cotización');
      res.json({ success: true, message: 'Cotización eliminada' });
    } catch (err) { next(err); }
  },

  async changeStatus(req, res, next) {
    try {
      const { status } = req.body;
      const userId = req.user.id; // User is authenticated via middleware
      await quotesService.changeStatus(req.params.id, status, userId);
      const updatedQuote = await repo.findById(req.params.id);
      res.json({ success: true, data: updatedQuote, message: 'Estado actualizado y reservas gestionadas' });
    } catch (err) { next(err); }
  },

  async downloadPdf(req, res, next) {
    try {
      const pdfBuffer = await generarPDFCotizacionCliente(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=cotizacion-${req.params.id}.pdf`);
      res.send(pdfBuffer);
    } catch (err) { next(err); }
  }
};
