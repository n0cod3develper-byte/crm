import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { uploadSingle } from '../../config/storage.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import * as ctrl from './catalog.controller.js';
import { verificarPermiso } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/',               ctrl.getItems);
router.get('/buscar',         ctrl.buscarItems);
router.get('/alertas',        ctrl.getAlertas);
router.get('/categorias',     ctrl.getCategorias);
router.get('/unidades',       ctrl.getUnidades);
router.get('/:id',            ctrl.getItem);

router.post('/',              ctrl.createItem);
router.post('/:id/imagen',     uploadLimiter, uploadSingle, ctrl.uploadImagen);
router.put('/:id',            ctrl.updateItem);
router.patch('/:id/stock', verificarPermiso('catalogo', 'editar'), ctrl.patchStock);

// Categorías
router.post('/categorias',    ctrl.createCategoria);
router.put('/categorias/:id', ctrl.updateCategoria);
router.delete('/categorias/:id', ctrl.deleteCategoria);

export default router;
