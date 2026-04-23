import { z } from 'zod';
import campaignsRepository from './campaigns.repository.js';

const campaignSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  type: z.string().optional(),
  status: z.enum(['planned', 'active', 'paused', 'completed', 'cancelled']).default('planned'),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  budget: z.coerce.number().min(0).default(0),
  expected_revenue: z.coerce.number().min(0).default(0),
  actual_revenue: z.coerce.number().min(0).default(0),
  actual_cost: z.coerce.number().min(0).default(0),
  description: z.string().optional().nullable(),
});

class CampaignsController {
  async getCampaigns(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';

      const { data, total } = await campaignsRepository.findAll({ skip, limit, search });
      
      res.json({
        success: true,
        data,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: { message: 'Failed to fetch campaigns' } });
    }
  }

  async getCampaignById(req, res) {
    try {
      const campaign = await campaignsRepository.findById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ success: false, error: { message: 'Campaign not found' } });
      }
      res.json({ success: true, data: campaign });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: { message: 'Failed to fetch campaign' } });
    }
  }

  async createCampaign(req, res) {
    try {
      const validatedData = campaignSchema.parse(req.body);
      const campaign = await campaignsRepository.create(validatedData);
      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { message: 'Validation error', details: error.errors } });
      }
      console.error(error);
      res.status(500).json({ success: false, error: { message: 'Failed to create campaign' } });
    }
  }

  async updateCampaign(req, res) {
    try {
      const { id } = req.params;
      const exist = await campaignsRepository.findById(id);
      if (!exist) {
        return res.status(404).json({ success: false, error: { message: 'Campaign not found' } });
      }

      const validatedData = campaignSchema.parse(req.body);
      const updated = await campaignsRepository.update(id, validatedData);
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { message: 'Validation error', details: error.errors } });
      }
      console.error(error);
      res.status(500).json({ success: false, error: { message: 'Failed to update campaign' } });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const deleted = await campaignsRepository.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: { message: 'Campaign not found' } });
      }
      res.json({ success: true, data: { id: req.params.id } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: { message: 'Failed to delete campaign' } });
    }
  }
}

export default new CampaignsController();
