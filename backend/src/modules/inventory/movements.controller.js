import { MovementsRepository } from './movements.repository.js';

const repo = new MovementsRepository();

export const getMovements = async (req, res) => {
  try {
    const { itemId, type, limit } = req.query;
    const data = await repo.findAll({ itemId, type, limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMovement = async (req, res) => {
  try {
    const userId = req.user?.id; // De Clerk/Auth middleware
    const movement = await repo.create(req.body, userId);
    res.status(201).json({ success: true, data: movement });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getMovementStats = async (req, res) => {
  try {
    const stats = await repo.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
