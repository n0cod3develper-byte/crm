import { Router } from 'express';
import { requireAuth, soloAdmin } from '../../middleware/auth.js';
import * as backupService from '../../services/backupService.js';
import fs from 'fs';
import { logger } from '../../utils/logger.js';

const router = Router();

// Todas las rutas de backups requieren autenticación y rol de admin
router.use(requireAuth);
router.use(soloAdmin);

/**
 * @route POST /api/backups/generate
 * @desc Genera un nuevo backup manualmente
 */
router.post('/generate', async (req, res, next) => {
  try {
    const result = await backupService.generateBackup(req.userId);
    res.json(result);
  } catch (error) {
    logger.error('Error endpoint /generate', { error: error.message });
    res.status(500).json({ error: 'No se pudo generar el backup' });
  }
});

/**
 * @route GET /api/backups/list
 * @desc Obtiene la lista de backups
 */
router.get('/list', (req, res) => {
  try {
    const backups = backupService.getBackupList();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo lista de backups' });
  }
});

/**
 * @route GET /api/backups/status
 * @desc Obtiene el uso de disco y conteo
 */
router.get('/status', (req, res) => {
  try {
    const status = backupService.getBackupStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estado' });
  }
});

/**
 * @route GET /api/backups/download/:filename
 * @desc Descarga un archivo de backup
 */
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = backupService.getBackupFilePath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    logger.info(`Descargando backup`, { filename, adminUserId: req.userId });
    res.download(filePath, filename);
  } catch (error) {
    logger.error('Error descargando backup', { error: error.message });
    res.status(500).json({ error: 'Error descargando archivo' });
  }
});

/**
 * @route DELETE /api/backups/:filename
 * @desc Elimina un archivo de backup
 */
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const deleted = backupService.deleteBackup(filename, req.userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    res.json({ message: 'Backup eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando backup' });
  }
});

export default router;
