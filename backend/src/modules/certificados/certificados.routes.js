import { Router } from 'express';
import { certificadosController } from './certificados.controller.js';
import { certificadoTemplateController } from './certificadoTemplate.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ─── Plantillas de certificado ──────────────────────────────────
router.get('/templates',                  certificadoTemplateController.listar);
router.get('/templates/variables',         certificadoTemplateController.getVariables);
router.get('/templates/:id',              certificadoTemplateController.obtener);
router.post('/templates',                 certificadoTemplateController.crear);
router.patch('/templates/:id',            certificadoTemplateController.actualizar);
router.delete('/templates/:id',           certificadoTemplateController.eliminar);
router.get('/templates/:id/versiones',    certificadoTemplateController.getVersiones);

// ─── Admin/RRHH: descargar certificado de cualquier empleado ────
router.get('/admin/:id', certificadosController.downloadAdmin);

// ─── Mi certificado (el empleado descarga el suyo) ──────────────
router.get('/mi-certificado', certificadosController.downloadMiCertificado);

export default router;
