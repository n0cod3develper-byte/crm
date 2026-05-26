import { Router } from 'express';
import multer from 'multer';
import { companiesController } from './companies.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);   // Todas las rutas requieren autenticación

// Multer para importación Excel (archivo en memoria, 5MB máx)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo archivos .xlsx o .xls'), false);
    }
  },
}).single('archivo');

router.get('/',              companiesController.list);
router.post('/bulk',         companiesController.bulkCreate);
router.post('/',             companiesController.create);
router.post('/import',       excelUpload, companiesController.importExcel);
router.get('/:id',           companiesController.get);
router.patch('/:id',         companiesController.update);
router.delete('/:id',        authorize('admin'), companiesController.remove);
router.get('/:id/timeline',  companiesController.timeline);

export default router;
