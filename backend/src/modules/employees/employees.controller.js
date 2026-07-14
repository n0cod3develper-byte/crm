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

  // ─── Historial Laboral ────────────────────────────────────────

  async getHistorial(req, res, next) {
    try {
      const historial = await repo.getHistorial(req.params.id);
      res.json({ success: true, data: historial });
    } catch (err) { next(err); }
  },

  async addHistorial(req, res, next) {
    try {
      const newHistorial = await repo.addHistorial(req.params.id, req.body);
      res.status(201).json({ success: true, data: newHistorial });
    } catch (err) { next(err); }
  },

  async removeHistorial(req, res, next) {
    try {
      const result = await repo.removeHistorial(req.params.historialId);
      if (!result) throw new NotFoundError('Registro de historial');
      res.json({ success: true, message: 'Registro eliminado' });
    } catch (err) { next(err); }
  },

  // ─── Documentos ───────────────────────────────────────────────

  async getDocumentos(req, res, next) {
    try {
      const documentos = await repo.getDocumentos(req.params.id);
      res.json({ success: true, data: documentos });
    } catch (err) { next(err); }
  },

  async addDocumento(req, res, next) {
    try {
      if (!req.file) throw new Error('No se ha subido ningún archivo');
      const { tipo_documento } = req.body;
      const subido_por = req.user?.id;
      
      const fs = await import('fs');
      const path = await import('path');
      
      const uploadDir = path.resolve('uploads/employees');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const destPath = path.join(uploadDir, fileName);
      
      fs.copyFileSync(req.file.path, destPath);
      fs.unlinkSync(req.file.path); // Eliminar de tmp

      const fileUrl = `/uploads/employees/${fileName}`;

      const newDoc = await repo.addDocumento(req.params.id, {
        tipo_documento: tipo_documento || 'Documento',
        nombre_archivo: req.file.originalname,
        url_archivo: fileUrl,
        subido_por
      });
      res.status(201).json({ success: true, data: newDoc });
    } catch (err) { next(err); }
  },

  async removeDocumento(req, res, next) {
    try {
      const doc = await repo.removeDocumento(req.params.docId);
      if (!doc) throw new NotFoundError('Documento');
      // Podríamos eliminar el archivo físico aquí si es necesario usando fs.unlink
      res.json({ success: true, message: 'Documento eliminado' });
    } catch (err) { next(err); }
  }
};

