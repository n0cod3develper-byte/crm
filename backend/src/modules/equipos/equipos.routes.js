import { Router } from 'express';


import { authenticate } from '../../middleware/auth.js';

import { equiposController, uploadMiddleware } from './equipos.controller.js';



const router = Router();
router.use(authenticate);

// ─── Ruta especial antes de /:id ──────────────────────────────
router.get('/tecnicos-disponibles', equiposController.getTecnicosDisponibles);
router.get('/by-company/:id',       equiposController.listByCompany);

// ─── CRUD Equipos ─────────────────────────────────────────────
router.get('/',     equiposController.list);
router.post('/',    equiposController.create);
router.get('/:id',  equiposController.get);
router.put('/:id',  equiposController.update);
router.delete('/:id', equiposController.remove);

// ─── Historial del Equipo ─────────────────────────────────────
router.get( '/:id/historial',                          equiposController.listHistorial);
router.post('/:id/historial',   uploadMiddleware,      equiposController.createHistorial);
router.get( '/:id/historial/:historialId',             equiposController.getHistorial);
router.put( '/:id/historial/:historialId', uploadMiddleware, equiposController.updateHistorial);
router.post('/:id/historial/:historialId/repuestos',   equiposController.addRepuestos);

export default router;
