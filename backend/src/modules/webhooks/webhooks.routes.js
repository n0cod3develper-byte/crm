import { Router } from 'express';
import { handleClerkWebhook } from './clerk.webhook.js';

const router = Router();

router.post('/clerk', handleClerkWebhook);

export default router;
