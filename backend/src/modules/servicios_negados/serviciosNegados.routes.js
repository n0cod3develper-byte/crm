import { Router } from 'express';
import * as ctrl from './serviciosNegados.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listar);
router.post('/', ctrl.crear);
router.delete('/:id', ctrl.eliminar);
router.get('/informe', ctrl.informe);
router.get('/causas', (req, res) => res.json({ success: true, data: ctrl.CAUSAS }));

export default router;
