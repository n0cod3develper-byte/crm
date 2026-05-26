import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { informesController } from './informes.controller.js';

const router = Router();
router.use(requireAuth);

// Opciones de filtros para los selectores
router.get('/filter-options',         informesController.getFilterOptions);

// Totalizado Final
router.get('/totalizado',             informesController.getTotalizadoFinal);
router.get('/totalizado/pdf',         informesController.exportTotalizadoPDF);
router.get('/totalizado/excel',       informesController.exportTotalizadoExcel);

// Liquidación Gestión Humana
router.get('/liquidacion',            informesController.getLiquidacion);
router.get('/liquidacion/pdf',        informesController.exportLiquidacionPDF);
router.get('/liquidacion/excel',      informesController.exportLiquidacionExcel);
router.get('/liquidacion/plantilla',  informesController.exportPlantillaGH);

// Histórico y comparativas
router.get('/comparativa/:tipo',      informesController.getComparativa);
router.post('/historico',             informesController.saveHistorico);

export default router;
