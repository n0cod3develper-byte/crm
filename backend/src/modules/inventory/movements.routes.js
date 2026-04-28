import { Router } from 'express';
import { getMovements, createMovement, getMovementStats, registrarEntrada } from './movements.controller.js';

const router = Router();

router.get('/', getMovements);
router.get('/stats', getMovementStats);
router.post('/', createMovement);
router.post('/entrada', registrarEntrada);

export default router;
