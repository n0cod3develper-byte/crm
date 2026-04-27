import { Router } from 'express';
import { getMovements, createMovement, getMovementStats } from './movements.controller.js';

const router = Router();

router.get('/', getMovements);
router.get('/stats', getMovementStats);
router.post('/', createMovement);

export default router;
