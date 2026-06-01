import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { inventoryExportController } from './inventory-export.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Export endpoints (deben ir antes de /:id para evitar conflictos)
router.get('/export',        inventoryExportController.export);
router.get('/export/resumen', inventoryExportController.exportResumen);

router.get('/',       inventoryController.list);
router.get('/search', inventoryController.search);  // Buscador para formulario OT
router.post('/',      inventoryController.create);
router.get('/:id',    inventoryController.get);
router.patch('/:id',  inventoryController.update);
router.delete('/:id', inventoryController.remove);

export default router;
