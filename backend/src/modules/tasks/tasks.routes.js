import { Router } from 'express';
import { tasksController } from './tasks.controller.js';
import { authenticate } from '../../utils/jwt.js';

const router = Router();
router.use(authenticate);

router.get('/',                tasksController.list);
router.post('/',               tasksController.create);
router.get('/:id',             tasksController.get);
router.patch('/:id',           tasksController.update);
router.patch('/:id/complete',  tasksController.complete);
router.delete('/:id',          tasksController.remove);

export default router;
