import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { budgetController } from './budget.controller.js';

const router = Router();
router.use(requireAuth);

// ── Áreas (compartido) ───────────────────────────────────
router.get('/areas', budgetController.getAreas);
router.post('/areas', budgetController.createArea);

// ── Presupuesto Anual (compartido) ───────────────────────
router.get('/annual', budgetController.getAnnualBudget);
router.post('/annual', budgetController.upsertAnnualBudget);

// ── Presupuesto por Equipo — Área 2 Servicios ───────────
router.get('/equipment', budgetController.getEquipmentBudgets);
router.post('/equipment', budgetController.upsertEquipmentBudget);
router.delete('/equipment/:id', budgetController.deleteEquipmentBudget);
router.get('/equipment/:id/monthly', budgetController.getEquipmentMonthlyDetails);

// ══════════════════════════════════════════════════════
// ÁREA 1 — MANTENIMIENTO: Líneas de Negocio
// ══════════════════════════════════════════════════════
router.get('/business-lines', budgetController.getBusinessLines);
router.get('/mantenimiento', budgetController.getMantenimientoPresupuesto);
router.post('/mantenimiento', budgetController.upsertMantenimientoPresupuesto);

export default router;

