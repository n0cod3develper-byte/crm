import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.js';
import { uploadSingle } from '../../config/storage.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import * as ctrl from './catalog.controller.js';
import { verificarPermiso } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Configuración de multer en memoria para carga de archivos Excel
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo se aceptan archivos .xlsx o .xls'), false);
    }
  },
}).single('archivo');

router.get('/',               ctrl.getItems);
router.get('/buscar',         ctrl.buscarItems);
router.get('/alertas',        ctrl.getAlertas);
router.get('/informe',        ctrl.getInforme);
router.get('/categorias',     ctrl.getCategorias);
router.get('/categorias/:id/siguiente-consecutivo', ctrl.getSiguienteConsecutivo);
router.get('/categorias/:id/siguiente-codigo', ctrl.getSiguienteCodigo);

router.get('/unidades',       ctrl.getUnidades);
router.get('/:id',            ctrl.getItem);

router.post('/',              ctrl.createItem);
router.post('/import',        uploadLimiter, excelUpload, ctrl.importExcel);
router.post('/:id/imagen',     uploadLimiter, uploadSingle, ctrl.uploadImagen);
router.put('/:id',            ctrl.updateItem);
router.patch('/:id/stock', verificarPermiso('catalogo', 'editar'), ctrl.patchStock);

// Categorías
router.post('/categorias',    ctrl.createCategoria);
router.put('/categorias/:id', ctrl.updateCategoria);
router.delete('/categorias/:id', ctrl.deleteCategoria);

export default router;
