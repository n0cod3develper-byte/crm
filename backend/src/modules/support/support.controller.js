import { SupportRepository } from './support.repository.js';
import { logger } from '../../utils/logger.js';

const repo = new SupportRepository();

// ─── TICKETS ──────────────────────────────────────────────────
export async function listTickets(req, res, next) {
  try {
    const { status, priority, assigned_to, company_id, search, limit, cursor } = req.query;
    const result = await repo.findAll({
      status, priority, assignedTo: assigned_to, companyId: company_id,
      search, limit: parseInt(limit) || 50, cursor,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req, res, next) {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req, res, next) {
  try {
    const ticket = await repo.create(req.body, req.user.id);
    logger.info('Ticket creado', { ticketId: ticket.id, userId: req.user.id });
    res.status(201).json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req, res, next) {
  try {
    const ticket = await repo.update(req.params.id, req.body);
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function deleteTicket(req, res, next) {
  try {
    const deleted = await repo.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Ticket no encontrado' });
    res.json({ message: 'Ticket eliminado', id: deleted.id });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const stats = await repo.getStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
}

// ─── MENSAJES ─────────────────────────────────────────────────
export async function listMessages(req, res, next) {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
    const messages = await repo.findMessages(req.params.id);
    res.json({ data: messages });
  } catch (err) {
    next(err);
  }
}

export async function addMessage(req, res, next) {
  try {
    const { body, is_internal } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ message: 'El cuerpo del mensaje es requerido' });
    }
    const ticket = await repo.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

    const message = await repo.addMessage(req.params.id, { body, is_internal }, req.user.id);
    res.status(201).json({ data: message });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const deleted = await repo.deleteMessage(req.params.messageId);
    if (!deleted) return res.status(404).json({ message: 'Mensaje no encontrado' });
    res.json({ message: 'Mensaje eliminado' });
  } catch (err) {
    next(err);
  }
}
