import { TasksRepository } from './tasks.repository.js';
const repo = new TasksRepository();

export class TasksService {
  async listTasks(params) {
    return repo.findAll(params);
  }
  async getTask(id) {
    return repo.findById(id);
  }
  async createTask(data, userId) {
    return repo.create(data, userId);
  }
  async updateTask(id, data, user) {
    const existingTask = await repo.findById(id);
    if (!existingTask) {
      throw new NotFoundError('Tarea no encontrada');
    }
    const isAdmin = user.role === 'admin' || user.role === 'administrador';
    const isAssigned = existingTask.assigned_to === user.id || existingTask.created_by === user.id || existingTask.supervisor_id === user.id;
    
    if (!isAdmin && !isAssigned) {
      const error = new Error('No tienes permisos para modificar esta tarea');
      error.statusCode = 403;
      throw error;
    }

    return repo.update(id, data);
  }
  async completeTask(id, user) {
    return this.updateTask(id, { status: 'completed' }, user);
  }
  async deleteTask(id, userId, role) {
    return repo.delete(id);
  }
  async getExpiringTasks(userId, role) {
    return repo.getExpiring(userId, role);
  }
  async saveFavoriteFilters(userId, name, filters) {
    return {};
  }
  async getFavoriteFilters(userId) {
    return [];
  }
}
