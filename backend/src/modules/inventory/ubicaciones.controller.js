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
  },

  async getPrefijos(req, res) {
    try {
      const data = await ubicacionesRepository.getPrefijos();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createPrefijo(req, res) {
    try {
      const data = await ubicacionesRepository.createPrefijo(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      const status = error.message.includes('unique') || error.code === '23505' ? 409 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  async updatePrefijo(req, res) {
    try {
      const data = await ubicacionesRepository.updatePrefijo(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async deletePrefijo(req, res) {
    try {
      await ubicacionesRepository.deletePrefijo(req.params.id);
      res.json({ success: true, message: 'Prefijo eliminado' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async getNiveles(req, res) {
    try {
      const data = await ubicacionesRepository.getNiveles();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createNivel(req, res) {
    try {
      const data = await ubicacionesRepository.createNivel(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      const status = error.message.includes('unique') || error.code === '23505' ? 409 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  async updateNivel(req, res) {
    try {
      const data = await ubicacionesRepository.updateNivel(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async deleteNivel(req, res) {
    try {
      await ubicacionesRepository.deleteNivel(req.params.id);
      res.json({ success: true, message: 'Nivel eliminado' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};
