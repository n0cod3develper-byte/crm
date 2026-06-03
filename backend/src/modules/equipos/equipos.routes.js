import { Router } from 'express';


import { authenticate } from '../../middleware/auth.js';
import multer from 'multer';

import { equiposController, uploadMiddleware } from './equipos.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

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

// ─── Nuevas rutas extendidas (main) ───────────────────────────
router.patch('/:id/estado',        equiposController.cambiarEstado);
router.patch('/:id/horometro',     equiposController.actualizarHorometro);
router.post('/:id/foto',           upload.single('foto'), equiposController.subirFoto);
router.get('/:id/foto',            equiposController.servirFoto);
router.delete('/:id/foto',         equiposController.eliminarFoto);
router.get('/:id/historial-estado', equiposController.historialEstado);

// ─── Historial del Equipo (Emily) ─────────────────────────────
router.get( '/:id/historial',                          equiposController.listHistorial);
router.post('/:id/historial',   uploadMiddleware,      equiposController.createHistorial);
router.get( '/:id/historial/:historialId',             equiposController.getHistorial);
router.put( '/:id/historial/:historialId', uploadMiddleware, equiposController.updateHistorial);
router.post('/:id/historial/:historialId/repuestos',   equiposController.addRepuestos);

export default router;
