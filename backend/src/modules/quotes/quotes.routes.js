import { Router } from 'express';
import { quotesController } from './quotes.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/',       quotesController.list);
router.post('/',      quotesController.create);
router.get('/:id',    quotesController.get);
router.patch('/:id',  quotesController.update);
router.delete('/:id', quotesController.remove);

export default router;
