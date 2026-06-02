import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ctrl from './mantenimientosProgramados.controller.js';

const router = Router();
router.use(authenticate);

// Configuración de Multer para evidencias
const uploadDir = path.resolve('uploads/mantenimientos-programados');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|zip|rar/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('Tipo de archivo no permitido'));
  },
});

// ─── PLANES ────────────────────────────────────────────────────
router.get('/planes',         ctrl.getPlanes);
router.get('/planes/:id',     ctrl.getPlan);
router.post('/planes',        ctrl.createPlan);
router.put('/planes/:id',     ctrl.updatePlan);
router.patch('/planes/:id/toggle', ctrl.togglePlan);
router.delete('/planes/:id',  ctrl.deletePlan);
router.post('/planes/:id/generar-orden', ctrl.generarOrden);

// ─── ÓRDENES ──────────────────────────────────────────────────
router.get('/ordenes',              ctrl.getOrdenes);
router.get('/ordenes/:id',          ctrl.getOrden);
router.post('/ordenes',             ctrl.createOrden);
router.put('/ordenes/:id',          ctrl.updateOrden);
router.patch('/ordenes/:id/estado', ctrl.cambiarEstado);
router.patch('/ordenes/:id/actividades/:actId', ctrl.completarActividad);
router.post('/ordenes/:id/evidencias', (req, res, next) => {
    upload.single('archivo')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ success: false, message: `Error de subida: ${err.message}` });
        }
        return res.status(400).json({ success: false, message: err.message || 'Error al subir archivo' });
      }
      next();
    });
  }, ctrl.subirEvidencia);
router.delete('/ordenes/:id/evidencias/:evId', ctrl.eliminarEvidencia);
router.get('/ordenes/:id/bitacora', ctrl.getBitacora);

// ─── CALENDARIO E HISTORIAL ───────────────────────────────────
router.get('/calendario',           ctrl.getCalendario);
router.get('/historial/equipo/:id', ctrl.getHistorialEquipo);
router.get('/historial/area/:id',   ctrl.getHistorialArea);

// ─── KPIs ─────────────────────────────────────────────────────
router.get('/dashboard/kpis',       ctrl.getKpis);

export default router;
