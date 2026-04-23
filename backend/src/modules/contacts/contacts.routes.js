import { Router } from 'express';
import { contactsController } from './contacts.controller.js';
import { authenticate } from '../../utils/jwt.js';

const router = Router();

router.use(authenticate);

router.get('/',       contactsController.list);
router.post('/',      contactsController.create);
router.get('/:id',    contactsController.get);
router.patch('/:id',  contactsController.update);
router.delete('/:id', contactsController.remove);

export default router;
