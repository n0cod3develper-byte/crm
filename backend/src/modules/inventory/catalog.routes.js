import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { uploadSingle } from '../../config/storage.js';
import * as ctrl from './catalog.controller.js';

const router = Router();
router.use(authenticate);

router.get('/',               ctrl.getItems);
router.get('/buscar',         ctrl.buscarItems);
router.get('/alertas',        ctrl.getAlertas);
router.get('/categorias',     ctrl.getCategorias);
router.get('/unidades',       ctrl.getUnidades);
router.get('/:id',            ctrl.getItem);

router.post('/',              ctrl.createItem);
router.post('/:id/imagen',     uploadSingle, ctrl.uploadImagen);
router.put('/:id',            ctrl.updateItem);
router.delete('/:id',         ctrl.deleteItem);

// Categorías
router.post('/categorias',    ctrl.createCategoria);
router.put('/categorias/:id', ctrl.updateCategoria);
router.delete('/categorias/:id', ctrl.deleteCategoria);

export default router;
