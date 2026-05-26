import { query } from '../../config/database.js';
import { EmployeesRepository } from './employees.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new EmployeesRepository();

export const employeesController = {
  async list(req, res, next) {
    try {
      const { position, status, search, limit, cursor } = req.query;
      const result = await repo.findAll({ position, status, search, limit: parseInt(limit) || 50, cursor });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const employee = await repo.findById(req.params.id);
      if (!employee) throw new NotFoundError('Empleado');
      res.json({ success: true, data: employee });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const employee = await repo.create(req.body);
      res.status(201).json({ success: true, data: employee });
    } catch (err) { next(err); }
  },

  async bulkCreate(req, res, next) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ success: false, message: 'Se esperaba un arreglo de empleados' });
      }
      const employees = await repo.bulkCreate(req.body);
      res.status(201).json({ success: true, count: employees.length, data: employees });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const employee = await repo.update(req.params.id, req.body);
      if (!employee) throw new NotFoundError('Empleado');
      res.json({ success: true, data: employee });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.delete(req.params.id);
      if (!result) throw new NotFoundError('Empleado');
      res.json({ success: true, message: 'Empleado eliminado' });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/employees/usuarios-disponibles
   * Retorna usuarios del sistema que NO están vinculados a ningún empleado,
   * más el usuario actualmente vinculado al empleado (si se pasa empleado_id).
   */
  async listUsuariosDisponibles(req, res, next) {
    try {
      const { empleado_id } = req.query;

      // Usuarios sin empleado vinculado
      const sql = `
        SELECT u.id, u.nombre, u.apellido, u.email
        FROM users u
        WHERE u.id NOT IN (
          SELECT user_id FROM employees WHERE user_id IS NOT NULL
        )
        ORDER BY u.nombre ASC
      `;
      const result = await query(sql);
      let usuarios = result.rows;

      // Si venimos editando un empleado, incluimos el usuario ya vinculado
      if (empleado_id) {
        const emp = await repo.findById(empleado_id);
        if (emp?.user_id) {
          const alreadyLinked = usuarios.find(u => u.id === emp.user_id);
          if (!alreadyLinked) {
            const userRes = await query(
              'SELECT id, nombre, apellido, email FROM users WHERE id = $1',
              [emp.user_id]
            );
            if (userRes.rows[0]) {
              usuarios.unshift(userRes.rows[0]);
            }
          }
        }
      }

      res.json({ success: true, data: usuarios });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/employees/:id/usuarios
   * Retorna usuarios vinculables (disponibles + el ya vinculado al empleado)
   */
  async listUsuariosParaEmpleado(req, res, next) {
    try {
      const { id } = req.params;

      // Verificar que el empleado existe
      const emp = await repo.findById(id);
      if (!emp) throw new NotFoundError('Empleado');

      // Usuarios disponibles (sin empleado) + el ya vinculado
      const sql = `
        SELECT u.id, u.nombre, u.apellido, u.email
        FROM users u
        WHERE u.id NOT IN (
          SELECT user_id FROM employees WHERE user_id IS NOT NULL AND user_id != $1
        )
        ORDER BY u.nombre ASC
      `;
      const result = await query(sql, [emp.user_id || null]);

      res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
  },
};
