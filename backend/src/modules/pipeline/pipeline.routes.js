import { Router } from 'express';
import { pipelineController } from './pipeline.controller.js';
import { authenticate } from '../../utils/jwt.js';

const router = Router();
router.use(authenticate);

router.get('/stages',          pipelineController.listStages);
router.post('/stages',         pipelineController.createStage);
router.patch('/stages/:id',    pipelineController.updateStage);

export default router;
