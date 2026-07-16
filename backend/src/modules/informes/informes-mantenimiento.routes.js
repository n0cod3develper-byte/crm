import { Router } from 'express';
import { informesController } from './informes.controller.js';

const router = Router();

// Órdenes de trabajo agrupadas por estado
router.get('/ordenes-por-estado', informesController.getOrdenesPorEstado);

// Top 10 equipos con más mantenimientos
router.get('/equipos-mas-mantenimientos', informesController.getEquiposMasMantenimientos);

// Distribución por tipo de mantenimiento (Correctivo / Preventivo)
router.get('/tipo-mantenimiento', informesController.getTipoMantenimiento);

export default router;
