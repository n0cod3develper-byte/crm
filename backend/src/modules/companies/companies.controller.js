import XLSX from 'xlsx';
import { CompaniesRepository } from './companies.repository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new CompaniesRepository();

export const companiesController = {
  async list(req, res, next) {
    try {
      const { search, assignedTo, tags, limit, cursor } = req.query;
      const result = await repo.findAll({
        search,
        assignedTo,
        tags: tags ? tags.split(',') : undefined,
        limit: parseInt(limit) || 20,
        cursor,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const company = await repo.findById(req.params.id);
      if (!company) throw new NotFoundError('Empresa');
      res.json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const company = await repo.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const company = await repo.update(req.params.id, req.body);
      if (!company) throw new NotFoundError('Empresa');
      res.json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.hardDelete(req.params.id);
      if (!result) throw new NotFoundError('Empresa');
      res.json({ success: true, message: 'Empresa eliminada correctamente de forma permanente' });
    } catch (err) { next(err); }
  },

  async importExcel(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'Debe enviar un archivo Excel (.xlsx)' }
        });
      }

      // Leer y parsear el Excel
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          error: { message: 'El archivo Excel no contiene hojas de trabajo' }
        });
      }

      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

      if (rawData.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'El archivo Excel no contiene datos (solo encabezados)' }
        });
      }

      if (rawData.length > 500) {
        return res.status(400).json({
          success: false,
          error: { message: `El archivo excede el límite de 500 filas (tiene ${rawData.length})` }
        });
      }

      // Mapear columnas del Excel a los campos del sistema
      const rows = rawData.map(row => ({
        nombre: row['Nombre *'] || row.Nombre || row.nombre || null,
        nit: row['NIT *'] || row.NIT || row.nit || null,
        telefono: row.Teléfono || row.Telefono || row.telefono || null,
        direccion: row['Dirección *'] || row.Dirección || row.Direccion || row.direccion || null,
        ciudad: row.Ciudad || row.ciudad || null,
        pais: row.País || row.Pais || row.pais || null,
        website: row['Sitio Web'] || row['Website'] || row.website || null,
        industry: row.Industria || row.Sector || row.industry || null,
        modelo_captacion: row['Modelo de Captación'] || row['Modelo Captacion'] || row.modelo_captacion || null,
        regimen: row['Régimen *'] || row.Régimen || row.Regimen || row.regimen || null,
        responsable_captacion_id: row['Responsable Captación ID'] || row['Responsable Captacion ID'] || row.responsable_captacion_id || null,
        correo_facturacion: row['Correo de Facturación'] || row['Correo Facturación'] || row['Correo Facturacion'] || row.correo_facturacion || null,
        correo_rut: row['Correo RUT'] || row['Correo Rut'] || row.correo_rut || null,
        tags: row.Tags || row.tags || row.Etiquetas || null,
        notas: row.Notas || row.notas || row['Notas Internas'] || null,
      }));

      const result = await repo.importCompanies(rows, req.user.id);

      res.json({
        success: true,
        data: {
          total: rows.length,
          importadas: result.success,
          errores: result.errors.length,
          detalle_errores: result.errors,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async timeline(req, res, next) {
    try {
      const { limit } = req.query;
      const items = await repo.getTimeline(req.params.id, parseInt(limit) || 30);
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  },

  // ─── Service Addresses ──────────────────────────────────────
  async getServiceAddresses(req, res, next) {
    try {
      const addresses = await repo.getServiceAddresses(req.params.id);
      res.json({ success: true, data: addresses });
    } catch (err) { next(err); }
  },

  async addServiceAddress(req, res, next) {
    try {
      const { address, notes } = req.body;
      if (!address) {
        return res.status(400).json({ success: false, error: { message: 'La dirección es obligatoria' } });
      }
      const newAddress = await repo.addServiceAddress(req.params.id, address, notes);
      res.status(201).json({ success: true, data: newAddress });
    } catch (err) { next(err); }
  },

  async deleteServiceAddress(req, res, next) {
    try {
      const result = await repo.deleteServiceAddress(req.params.addressId);
      if (!result) throw new NotFoundError('Dirección de servicio');
      res.json({ success: true, message: 'Dirección de servicio eliminada correctamente' });
    } catch (err) { next(err); }
  },
};
