import { Router } from 'express';
import { supplierQuotesController } from './supplier_quotes.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', supplierQuotesController.list);
router.post('/', supplierQuotesController.create);
router.get('/:id', supplierQuotesController.get);
router.patch('/:id', supplierQuotesController.update);
router.delete('/:id', supplierQuotesController.remove);

export default router;
