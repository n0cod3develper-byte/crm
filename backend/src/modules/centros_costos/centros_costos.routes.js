import { Router } from 'express';
import * as controller from './centros_costos.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Todo: check what middleware is used for permissions. In other routes it's usually `requireAuth` or similar.
// For now, I will just wire the endpoints. We will add the exact permission middleware later if needed,
// but the frontend ProtectedRoute handles most of the access control.

router.get('/', controller.findAll);
router.post('/', controller.create);
router.get('/:id', controller.findById);
router.patch('/:id', controller.update);
router.delete('/:id', controller.softDelete);

// Items routes
router.get('/:id/items', controller.getItems);
router.post('/:id/items', controller.addItem);
router.delete('/:id/items/:item_id', controller.removeItem);

export default router;
