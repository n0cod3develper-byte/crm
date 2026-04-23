import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticate } from '../../utils/jwt.js';

const router = Router();

router.use(authenticate);

router.get('/',       inventoryController.list);
router.get('/search', inventoryController.search);  // Buscador para formulario OT
router.post('/',      inventoryController.create);
router.get('/:id',    inventoryController.get);
router.patch('/:id',  inventoryController.update);
router.delete('/:id', inventoryController.remove);

export default router;
