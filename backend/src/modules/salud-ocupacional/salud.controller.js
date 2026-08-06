import { saludRepository } from './salud.repository.js';
import { logger } from '../../utils/logger.js';

// Helper: RBAC check for salud ocupacional
function checkSaludAccess(userRole) {
  const allowed = ['admin', 'rrhh', 'aprobador_1', 'gerencia'];
  if (!allowed.includes(userRole)) {
    const err = new Error('Acceso restringido: solo roles Administrador/SST/RRHH/Gerencia pueden ver datos de salud ocupacional');
    err.statusCode = 403;
    throw err;
  }
}

export const saludController = {
  async getExamenes(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.getExamenes(req.params.empleadoId); res.json({ data }); }
    catch (e) { logger.error('getExamenes', { error: e.message }); next(e); }
  },
  async createExamen(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.createExamen({ ...req.body, empleado_id: req.params.empleadoId, registrado_por: req.userId }); res.status(201).json({ data }); }
    catch (e) { logger.error('createExamen', { error: e.message }); next(e); }
  },
  async deleteExamen(req, res, next) {
    try { checkSaludAccess(req.user.role); await saludRepository.deleteExamen(req.params.id); res.json({ message: 'Eliminado' }); }
    catch (e) { logger.error('deleteExamen', { error: e.message }); next(e); }
  },

  async getRestricciones(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.getRestricciones(req.params.empleadoId); res.json({ data }); }
    catch (e) { logger.error('getRestricciones', { error: e.message }); next(e); }
  },
  async createRestriccion(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.createRestriccion({ ...req.body, empleado_id: req.params.empleadoId, registrado_por: req.userId }); res.status(201).json({ data }); }
    catch (e) { logger.error('createRestriccion', { error: e.message }); next(e); }
  },
  async updateRestriccion(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.updateRestriccion(req.params.id, req.body); res.json({ data }); }
    catch (e) { logger.error('updateRestriccion', { error: e.message }); next(e); }
  },
  async deleteRestriccion(req, res, next) {
    try { checkSaludAccess(req.user.role); await saludRepository.deleteRestriccion(req.params.id); res.json({ message: 'Eliminado' }); }
    catch (e) { logger.error('deleteRestriccion', { error: e.message }); next(e); }
  },

  async getEPP(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.getEPP(req.params.empleadoId); res.json({ data }); }
    catch (e) { logger.error('getEPP', { error: e.message }); next(e); }
  },
  async createEPP(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.createEPP({ ...req.body, empleado_id: req.params.empleadoId, registrado_por: req.userId }); res.status(201).json({ data }); }
    catch (e) { logger.error('createEPP', { error: e.message }); next(e); }
  },
  async deleteEPP(req, res, next) {
    try { checkSaludAccess(req.user.role); await saludRepository.deleteEPP(req.params.id); res.json({ message: 'Eliminado' }); }
    catch (e) { logger.error('deleteEPP', { error: e.message }); next(e); }
  },

  async getAccidentes(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.getAccidentes(req.params.empleadoId); res.json({ data }); }
    catch (e) { logger.error('getAccidentes', { error: e.message }); next(e); }
  },
  async createAccidente(req, res, next) {
    try { checkSaludAccess(req.user.role); const data = await saludRepository.createAccidente({ ...req.body, empleado_id: req.params.empleadoId, registrado_por: req.userId }); res.status(201).json({ data }); }
    catch (e) { logger.error('createAccidente', { error: e.message }); next(e); }
  },
  async deleteAccidente(req, res, next) {
    try { checkSaludAccess(req.user.role); await saludRepository.deleteAccidente(req.params.id); res.json({ message: 'Eliminado' }); }
    catch (e) { logger.error('deleteAccidente', { error: e.message }); next(e); }
  },
};
