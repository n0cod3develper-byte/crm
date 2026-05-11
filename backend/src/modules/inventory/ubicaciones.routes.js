import { Router } from 'express';
import { ubicacionesController } from './ubicaciones.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

// ─── Prefijos (MUST be before /:id) ──────────────────────────
router.get('/prefijos',          ubicacionesController.getPrefijos);
router.post('/prefijos',         ubicacionesController.createPrefijo);
router.put('/prefijos/:id',      ubicacionesController.updatePrefijo);
router.delete('/prefijos/:id',   ubicacionesController.deletePrefijo);

// ─── Niveles (MUST be before /:id) ───────────────────────────
router.get('/niveles',           ubicacionesController.getNiveles);
router.post('/niveles',          ubicacionesController.createNivel);
router.put('/niveles/:id',       ubicacionesController.updateNivel);
router.delete('/niveles/:id',    ubicacionesController.deleteNivel);

// ─── Stats (MUST be before /:id) ─────────────────────────────
router.get('/stats',  ubicacionesController.getStats);

// ─── Ubicaciones ─────────────────────────────────────────────
router.get('/',       ubicacionesController.list);
router.post('/',      ubicacionesController.create);
router.get('/:id',    ubicacionesController.get);
router.put('/:id',    ubicacionesController.update);
router.delete('/:id', ubicacionesController.remove);

export default router;
