import { ContactsRepository } from './contacts.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new ContactsRepository();

export const contactsController = {
  async list(req, res, next) {
    try {
      const { companyId, search, limit, cursor } = req.query;
      const result = await repo.findAll({
        companyId,
        search,
        limit: parseInt(limit) || 50,
        cursor,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const contact = await repo.findById(req.params.id);
      if (!contact) throw new NotFoundError('Contacto');
      res.json({ success: true, data: contact });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const contact = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: contact });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const contact = await repo.update(req.params.id, req.body);
      if (!contact) throw new NotFoundError('Contacto');
      res.json({ success: true, data: contact });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.softDelete(req.params.id);
      if (!result) throw new NotFoundError('Contacto');
      res.json({ success: true, message: 'Contacto eliminado correctamente' });
    } catch (err) { next(err); }
  },
};
