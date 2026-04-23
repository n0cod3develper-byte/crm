import { Router } from 'express';
import { opportunitiesController } from './opportunities.controller.js';
import { authenticate, authorize } from '../../utils/jwt.js';

const router = Router();
router.use(authenticate);

router.get('/',              opportunitiesController.list);
router.get('/summary',       opportunitiesController.summary);
router.post('/',             opportunitiesController.create);
router.get('/:id',           opportunitiesController.get);
router.patch('/:id',         opportunitiesController.update);
router.patch('/:id/move',    opportunitiesController.moveStage);
router.delete('/:id',        authorize('admin'), opportunitiesController.remove);

export default router;
