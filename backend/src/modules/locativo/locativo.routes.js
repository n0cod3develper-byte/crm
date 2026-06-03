import { Router } from 'express';
import { locativoController } from './locativo.controller.js';
import { authenticate } from '../../middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

// Subcategorías (debe ir antes de /:id para evitar conflictos)
router.get('/subcategorias', locativoController.listSubcategorias);
router.get('/resumen-contable', locativoController.resumenContable);
router.get('/exportar', locativoController.exportar);

// CRUD
router.get('/',       locativoController.list);
router.post('/',      locativoController.create);
router.get('/:id',    locativoController.get);
router.put('/:id',    locativoController.update);

// Estado
router.patch('/:id/estado', locativoController.cambiarEstado);

// Foto
router.post('/:id/foto', upload.single('foto'), locativoController.subirFoto);
router.get('/:id/foto',   locativoController.servirFoto);

export default router;
