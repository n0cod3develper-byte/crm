import { Router } from 'express';
import { equiposController } from './equipos.controller.js';
import { authenticate } from '../../middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/',                    equiposController.list);
router.post('/',                   equiposController.create);
router.get('/:id',                 equiposController.get);
router.put('/:id',                 equiposController.update); // PUT como pidió el usuario
router.delete('/:id',              equiposController.remove);

// Nuevas rutas extendidas
router.patch('/:id/estado',        equiposController.cambiarEstado);
router.patch('/:id/horometro',     equiposController.actualizarHorometro);
router.post('/:id/foto',           upload.single('foto'), equiposController.subirFoto);
router.get('/:id/foto',            equiposController.servirFoto);
router.delete('/:id/foto',         equiposController.eliminarFoto);
router.get('/:id/historial-estado', equiposController.historialEstado);

// Ruta adicional solicitada: Listar equipos de una empresa específica
router.get('/by-company/:id',      equiposController.listByCompany);

export default router;

