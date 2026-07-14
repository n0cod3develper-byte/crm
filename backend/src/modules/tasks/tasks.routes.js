import { Router } from 'express';
import { tasksController } from './tasks.controller.js';
import { tasksChecklistController } from './tasks-checklist.controller.js';
import { tasksCommentsController } from './tasks-comments.controller.js';
import { tasksAttachmentsController, uploadTaskAttachment } from './tasks-attachments.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { TasksService } from './tasks.service.js';
const tasksService = new TasksService();

const router = Router();
router.use(authenticate);

// Usuarios asignables
router.get('/users/assignable', tasksController.getAssignableUsers);

// Tareas (Main)
router.get('/',                tasksController.list);
router.post('/',               tasksController.create);
router.get('/expiring',        tasksController.getExpiring);
router.get('/:id',             tasksController.get);
router.patch('/:id',           tasksController.update);
router.patch('/:id/complete',  tasksController.complete);
router.delete('/:id',          tasksController.remove);

// Historial
router.get('/:id/history',     tasksController.getHistory);

// Checklist
router.get('/:id/checklist',            tasksChecklistController.list);
router.post('/:id/checklist',           tasksChecklistController.add);
router.patch('/:id/checklist/:itemId',  tasksChecklistController.update);
router.delete('/:id/checklist/:itemId', tasksChecklistController.remove);

// Comentarios
router.get('/:id/comments',           tasksCommentsController.list);
router.post('/:id/comments',          tasksCommentsController.add);
router.patch('/:id/comments/:cId',    tasksCommentsController.update);
router.delete('/:id/comments/:cId',   tasksCommentsController.remove);

// Adjuntos
router.get('/:id/attachments',        tasksAttachmentsController.list);
router.post('/:id/attachments',       uploadTaskAttachment.single('file'), tasksAttachmentsController.upload);
router.delete('/:id/attachments/:aId',tasksAttachmentsController.remove);

// Favorites (named filters)
router.post('/favorites', async (req, res, next) => {
  try {
    const { name, filters } = req.body;
    const result = await tasksService.saveFavoriteFilters(req.user.id, name, filters);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/favorites', async (req, res, next) => {
  try {
    const result = await tasksService.getFavoriteFilters(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
