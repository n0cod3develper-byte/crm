import { Router } from 'express';
import { authenticate } from '../../utils/jwt.js';
import {
  listTickets, getTicket, createTicket, updateTicket, deleteTicket, getStats,
  listMessages, addMessage, deleteMessage,
} from './support.controller.js';

const router = Router();

router.use(authenticate);

// Stats
router.get('/stats', getStats);

// Tickets CRUD
router.get('/',          listTickets);
router.get('/:id',       getTicket);
router.post('/',         createTicket);
router.patch('/:id',     updateTicket);
router.delete('/:id',    deleteTicket);

// Mensajes de un ticket
router.get('/:id/messages',              listMessages);
router.post('/:id/messages',             addMessage);
router.delete('/:id/messages/:messageId', deleteMessage);

export default router;
