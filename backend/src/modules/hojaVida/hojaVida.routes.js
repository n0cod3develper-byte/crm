import { Router } from 'express';
import { requireAuth, authorize } from '../../middleware/auth.js';
import { getHojaDeVida, exportExcel, exportPdf } from './hojaVida.controller.js';

const router = Router();
router.use(requireAuth);

// Permisos: cualquier usuario autentrado puede ver la hoja de vida de un equipo.
// (RBAC dinámico del sistema ya filtra por empresa; si se quiere restringir por
//  rol, se puede añadir authorize(…) aquí sin cambiar lógica existente.)
router.get('/:id/hoja-de-vida', authorize('*'), getHojaDeVida);
router.get('/:id/hoja-de-vida/export/excel', authorize('*'), exportExcel);
router.get('/:id/hoja-de-vida/export/pdf', authorize('*'), exportPdf);

export default router;
