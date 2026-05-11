import { Router } from 'express';
import { companiesController } from './companies.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);   // Todas las rutas requieren autenticación

router.get('/',              companiesController.list);
router.post('/bulk',         companiesController.bulkCreate);
router.post('/',             companiesController.create);
router.get('/:id',           companiesController.get);
router.patch('/:id',         companiesController.update);
router.delete('/:id',        authorize('admin'), companiesController.remove);
router.get('/:id/timeline',  companiesController.timeline);

export default router;
