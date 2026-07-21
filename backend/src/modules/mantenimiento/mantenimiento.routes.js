import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as ctrl from './mantenimiento.controller.js';
import * as pmCtrl from './pm.controller.js';
import * as compCtrl from './componentes.controller.js';

const router = Router();
router.use(authenticate);

// ─── KPIs (Dashboard) ────────────────────────────────────────
router.get('/kpis',     ctrl.getKpis);

// ─── Catálogo de Componentes ─────────────────────────────────
router.get('/componentes/activos', compCtrl.getAllActive);
router.get('/componentes', compCtrl.getAll);
router.post('/componentes', compCtrl.create);
router.put('/componentes/:id', compCtrl.update);

// ─── Órdenes de trabajo ─────────────────────────────────────
router.get('/ot',       ctrl.getAllOTs);
router.get('/ot/:id',   ctrl.getOT);
router.post('/ot',      ctrl.createOT);
router.put('/ot/:id',   ctrl.updateOT);
router.delete('/ot/:id', ctrl.deleteOT);

// ─── Técnicos de la OT ─────────────────────────────────────
router.post('/ot/:id/tecnicos',          ctrl.addTecnico);
router.put('/ot/:id/tecnicos/:tid',      ctrl.updateTecnico);
router.delete('/ot/:id/tecnicos/:tid',   ctrl.removeTecnico);

// ─── Repuestos e insumos ────────────────────────────────────
router.post('/ot/:id/repuestos',         ctrl.addRepuesto);
router.put('/ot/:id/repuestos/:rid',     ctrl.updateRepuesto);
router.delete('/ot/:id/repuestos/:rid',  ctrl.removeRepuesto);

// ─── Actividades PM de la OT ────────────────────────────────
router.put('/ot/:id/actividades/:aid',   pmCtrl.updateActividadOT);

// ─── Liquidación ────────────────────────────────────────────
router.post('/ot/:id/liquidar',          ctrl.liquidar);

// ─── PDF ────────────────────────────────────────────────────
router.get('/ot/:id/pdf',               ctrl.downloadPDF);

// ═══════════════════════════════════════════════════════════
// PREVENTIVO MAINTENANCE — Catálogo de Plantillas (Admin)
// ═══════════════════════════════════════════════════════════

// Frecuencias
router.get('/pm/frecuencias',                    pmCtrl.getAllFrecuencias);
router.get('/pm/frecuencias/:id/plantilla',      pmCtrl.getPlantilla);
router.post('/pm/frecuencias',                   pmCtrl.createFrecuencia);
router.put('/pm/frecuencias/:id',                pmCtrl.updateFrecuencia);

// Actividades de la plantilla
router.post('/pm/frecuencias/:id/actividades',   pmCtrl.addActividad);
router.put('/pm/actividades/:id',                pmCtrl.updateActividad);

// Insumos de la plantilla
router.post('/pm/frecuencias/:id/insumos',       pmCtrl.addInsumo);
router.put('/pm/insumos/:id',                    pmCtrl.updateInsumo);

export default router;
