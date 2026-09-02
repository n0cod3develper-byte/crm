import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { requireAuth, verificarPermiso } from '../../middleware/auth.js';
import * as controller from './contabilidad.controller.js';

const router = Router();

// Configuración de almacenamiento en disco temporal para contabilidad
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, os.tmpdir());
  },
  filename: function (req, file, cb) {
    cb(null, `contabilidad-${Date.now()}-${file.originalname}`);
  }
});

// Filtro flexible que acepta Excel, CSV, TSV, TXT
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.xlsx', '.xls', '.csv', '.tsv', '.txt'];
  
  if (allowedExts.includes(ext) || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.mimetype.includes('text') || file.mimetype.includes('csv')) {
    cb(null, true);
  } else {
    cb(
      new Error(`Formato no permitido: ${file.originalname}. Formatos aceptados: Excel (.xlsx, .xls), CSV (.csv), Texto/TSV (.tsv, .txt)`),
      false
    );
  }
};

const uploadContabilidad = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
}).single('documento');

// Todos los endpoints de contabilidad requieren autenticación
router.use(requireAuth);

router.post(
  '/importar',
  verificarPermiso('contabilidad', 'crear'),
  uploadContabilidad,
  controller.importarController
);

router.get(
  '/plantilla',
  verificarPermiso('contabilidad', 'ver'),
  controller.descargarPlantillaController
);

router.get(
  '/periodos',
  verificarPermiso('contabilidad', 'ver'),
  controller.getPeriodosController
);

router.get(
  '/reporte',
  verificarPermiso('contabilidad', 'ver'),
  controller.getReporteController
);

router.get(
  '/cuentas',
  verificarPermiso('contabilidad', 'ver'),
  controller.getCuentasController
);

router.get(
  '/rubros',
  verificarPermiso('contabilidad', 'ver'),
  controller.getRubrosController
);

router.put(
  '/cuentas/:codigo/mapeo',
  verificarPermiso('contabilidad', 'editar'),
  controller.putMapeoController
);

export default router;
