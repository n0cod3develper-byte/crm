import { Router } from 'express';
import { certificadosPublicoController } from './certificadosPublico.controller.js';
import { certificadoLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// ─── Portal Público de Certificados (sin autenticación) ──────
// Rate limiting estricto: 5 solicitudes por IP por hora

router.post('/solicitar', certificadoLimiter, certificadosPublicoController.solicitar);
router.post('/validar-otp', certificadoLimiter, certificadosPublicoController.validarOtp);
router.get('/descargar/:downloadToken', certificadoLimiter, certificadosPublicoController.descargar);

export default router;
