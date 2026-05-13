import { Router } from 'express';
import { catalogoServiciosController } from './catalogo_servicios.controller.js';
import { authenticate } from '../../utils/jwt.js';

const router = Router();
router.use(authenticate);

router.get('/',    catalogoServiciosController.list);
router.post('/',   catalogoServiciosController.create);
router.get('/:id', catalogoServiciosController.get);
router.put('/:id', catalogoServiciosController.update);
router.delete('/:id', catalogoServiciosController.remove);

export default router;
