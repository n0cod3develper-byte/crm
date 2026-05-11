import { Router } from 'express';
import { ubicacionesController } from './ubicaciones.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/',       ubicacionesController.list);
router.get('/stats',  ubicacionesController.getStats);
router.post('/',      ubicacionesController.create);
router.get('/:id',    ubicacionesController.get);
router.put('/:id',    ubicacionesController.update);
router.delete('/:id', ubicacionesController.remove);

export default router;
