import express from 'express';
import campaignsController from './campaigns.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', campaignsController.getCampaigns);
router.get('/:id', campaignsController.getCampaignById);
router.post('/', campaignsController.createCampaign);
router.patch('/:id', campaignsController.updateCampaign);
router.delete('/:id', campaignsController.deleteCampaign);

export default router;
