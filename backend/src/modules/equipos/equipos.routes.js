import { Router } from 'express';
import { equiposController } from './equipos.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/',               equiposController.list);
router.post('/',              equiposController.create);
router.get('/:id',            equiposController.get);
router.put('/:id',            equiposController.update); // PUT como pidió el usuario
router.delete('/:id',         equiposController.remove);

// Ruta adicional solicitada: Listar equipos de una empresa específica
// El usuario pidió /api/empresas/:id/equipos, pero por consistencia con el prefijo /api/v1 
// y el sistema modular, lo registraremos también en las rutas de empresas o aquí.
// Lo pondré aquí por ahora y lo referenciaré en app.js si es necesario.
router.get('/by-company/:id', equiposController.listByCompany);

export default router;
