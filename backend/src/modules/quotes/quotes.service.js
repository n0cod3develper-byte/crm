import { QuotesRepository } from './quotes.repository.js';

const repo = new QuotesRepository();

export const quotesService = {
  async createQuote(data, userId) {
    return repo.create(data, userId);
  },

  async updateQuote(id, data, userId) {
    return repo.update(id, data);
  },

  async changeStatus(id, status, userId) {
    // Actualizar el estado de la cotización
    // NOTA: Si en el futuro se requiere gestión de reservas de inventario (ej. al aprobar), 
    // se debe integrar con inventoryMovements.service.js aquí.
    return repo.update(id, { status });
  }
};
