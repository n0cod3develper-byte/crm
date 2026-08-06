import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './quotes_servicios.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.getQuotes);
router.post('/', controller.createQuote);
router.get('/:id', controller.getQuote);
router.put('/:id', controller.updateQuote);
router.delete('/:id', controller.deleteQuote);
router.patch('/:id/status', controller.updateQuoteStatus);
router.get('/:id/pdf', controller.downloadPDF);

export default router;
