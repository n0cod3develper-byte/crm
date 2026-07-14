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
  async updateTask(id, data, userId) {
    return repo.update(id, data);
  }
  async completeTask(id, userId) {
    return repo.update(id, { status: 'completed' });
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
