import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { budgetController } from './budget.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/areas', budgetController.getAreas);
router.post('/areas', budgetController.createArea);

router.get('/annual', budgetController.getAnnualBudget);
router.post('/annual', budgetController.upsertAnnualBudget);

router.get('/equipment', budgetController.getEquipmentBudgets);
router.post('/equipment', budgetController.upsertEquipmentBudget);
router.delete('/equipment/:id', budgetController.deleteEquipmentBudget);

router.get('/equipment/:id/monthly', budgetController.getEquipmentMonthlyDetails);

export default router;
