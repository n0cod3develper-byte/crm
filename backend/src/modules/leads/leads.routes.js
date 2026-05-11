import { Router } from 'express';
import { leadsController } from './leads.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/',               leadsController.list);
router.post('/',              leadsController.create);
router.get('/:id',            leadsController.get);
router.patch('/:id',          leadsController.update);
router.patch('/:id/convert',  leadsController.convert);
router.delete('/:id',         leadsController.remove);

export default router;
