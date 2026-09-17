/**
 * horasExtras.routes.js
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { horasExtrasController } from './horasExtras.controller.js';

const router = Router();
router.use(requireAuth);

// ─── Configuración ──────────────────────────────────────────
router.get('/configuracion',      horasExtrasController.getConfiguracion);
router.put('/configuracion/:id',  horasExtrasController.updateConfiguracion);

// ─── Festivos ───────────────────────────────────────────────
router.get('/festivos',           horasExtrasController.getFestivos);

// ─── Operarios (para filtros) ───────────────────────────────
router.get('/operarios',          horasExtrasController.getOperarios);

// ─── Resumen agrupado (nuevo) ───────────────────────────────
router.get('/resumen',            horasExtrasController.getResumenAgrupado);

// ─── Gestión Humana ─────────────────────────────────────────
router.get('/gestion-humana',     horasExtrasController.getInformeGestionHumana);

// ─── Detalle de segmentos ───────────────────────────────────
router.get('/detalle/:jornada_id', horasExtrasController.getDetalle);

// ─── Creación y Cálculos ────────────────────────────────────
router.post('/jornada',           horasExtrasController.crearJornadaManual);
router.patch('/jornada/:id/observacion', horasExtrasController.updateObservacion);
router.post('/calcular-remision/:remision_id', horasExtrasController.calcularDesdeRemision);

export default router;
