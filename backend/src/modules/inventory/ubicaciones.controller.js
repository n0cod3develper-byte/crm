import { ubicacionesRepository } from './ubicaciones.repository.js';

export const ubicacionesController = {
  async list(req, res) {
    try {
      const { search, activo } = req.query;
      const data = await ubicacionesRepository.findAll({ search, activo });
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async get(req, res) {
    try {
      const data = await ubicacionesRepository.findById(req.params.id);
      if (!data) return res.status(404).json({ success: false, message: 'Ubicación no encontrada' });
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await ubicacionesRepository.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await ubicacionesRepository.update(req.params.id, req.body);
      if (!data) return res.status(404).json({ success: false, message: 'Ubicación no encontrada' });
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await ubicacionesRepository.delete(req.params.id);
      res.json({ success: true, message: 'Ubicación eliminada' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async getStats(req, res) {
    try {
      const data = await ubicacionesRepository.getStats();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
