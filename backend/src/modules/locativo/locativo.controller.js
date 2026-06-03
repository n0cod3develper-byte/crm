import { LocativoRepository } from './locativo.repository.js';
import { validarReglasContables, generarCodigoLocativo, prepararDatosLocativo } from './locativo.service.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { query, withTransaction } from '../../config/database.js';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getUploadsBasePath, asegurarCarpeta } from '../../config/storage.js';

const repo = new LocativoRepository();

export const locativoController = {
  // ─── GET /api/inventario/locativo ──────────────────────────
  async list(req, res, next) {
    try {
      const { grupo, subcategoria, clasificacion_contable, sede, estado_fisico, responsable_id, q, page, limit } = req.query;
      const result = await repo.findAll({
        grupo,
        subcategoria,
        clasificacion_contable,
        sede,
        estado_fisico,
        responsable_id,
        search: q,
        limit: parseInt(limit) || 20,
        page: parseInt(page) || 1,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  // ─── GET /api/inventario/locativo/subcategorias ────────────
  async listSubcategorias(req, res, next) {
    try {
      const subcategorias = await repo.getSubcategorias();
      // Agrupar por grupo
      const agrupadas = { A: [], B: [], C: [] };
      for (const s of subcategorias) {
        agrupadas[s.grupo] = agrupadas[s.grupo] || [];
        agrupadas[s.grupo].push(s);
      }
      res.json({ success: true, data: agrupadas, lista: subcategorias });
    } catch (err) { next(err); }
  },

  // ─── GET /api/inventario/locativo/:id ──────────────────────
  async get(req, res, next) {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) throw new NotFoundError('Item locativo');
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  // ─── POST /api/inventario/locativo ─────────────────────────
  async create(req, res, next) {
    try {
      const datos = req.body;

      // Validaciones de negocio NIIF/ET
      const erroresContables = validarReglasContables(datos);
      if (erroresContables.length > 0) {
        return res.status(400).json({ success: false, errores: erroresContables });
      }

      // Generar código interno LOC-YYYY-XXXXX
      const codigoInterno = await generarCodigoLocativo();

      // Preparar datos
      const userStr = req.user
        ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email
        : 'Sistema';

      const preparados = prepararDatosLocativo(datos, req.user);

      // Si hay responsable_id, obtener snapshot del nombre
      if (preparados.responsable_id && !preparados.responsable_nombre) {
        const empRes = await query('SELECT full_name FROM employees WHERE id = $1', [preparados.responsable_id]);
        if (empRes.rows[0]) {
          preparados.responsable_nombre = empRes.rows[0].full_name;
        }
      }

      // Si hay proveedor_id, obtener snapshot del nombre
      if (preparados.proveedor_id && !preparados.proveedor_nombre) {
        const provRes = await query('SELECT name FROM proveedores WHERE id = $1', [preparados.proveedor_id]);
        if (provRes.rows[0]) {
          preparados.proveedor_nombre = provRes.rows[0].name;
        }
      }

      const item = await repo.create({
        ...preparados,
        codigo_interno: codigoInterno,
        registrado_por: userStr,
      });

      res.status(201).json({ success: true, data: item });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ success: false, error: { message: 'El código interno o placa ya existe' } });
      }
      next(err);
    }
  },

  // ─── PUT /api/inventario/locativo/:id ──────────────────────
  async update(req, res, next) {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) throw new NotFoundError('Item locativo');

      const datos = req.body;

      // Si cambia clasificación, validar reglas contables
      if (datos.clasificacion_contable && datos.clasificacion_contable !== item.clasificacion_contable) {
        const erroresContables = validarReglasContables({ ...item, ...datos });
        if (erroresContables.length > 0) {
          return res.status(400).json({ success: false, errores: erroresContables });
        }
      }

      // Preparar datos
      const preparados = prepararDatosLocativo(datos, req.user);

      // Snapshot de responsable si cambió
      if (preparados.responsable_id && preparados.responsable_id !== item.responsable_id) {
        const empRes = await query('SELECT full_name FROM employees WHERE id = $1', [preparados.responsable_id]);
        if (empRes.rows[0]) {
          preparados.responsable_nombre = empRes.rows[0].full_name;
        }
      }

      // Snapshot de proveedor si cambió
      if (preparados.proveedor_id && preparados.proveedor_id !== item.proveedor_id) {
        const provRes = await query('SELECT name FROM proveedores WHERE id = $1', [preparados.proveedor_id]);
        if (provRes.rows[0]) {
          preparados.proveedor_nombre = provRes.rows[0].name;
        }
      }

      const updated = await repo.update(req.params.id, preparados);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ success: false, error: { message: 'El código de placa ya existe' } });
      }
      next(err);
    }
  },

  // ─── PATCH /api/inventario/locativo/:id/estado ──────────────
  async cambiarEstado(req, res, next) {
    try {
      const { estado_fisico, observaciones } = req.body;
      if (!estado_fisico) throw new BadRequestError('El estado físico es obligatorio');

      const validEstados = ['NUEVO', 'BUENO', 'REGULAR', 'MALO', 'DADO_DE_BAJA'];
      if (!validEstados.includes(estado_fisico)) {
        throw new BadRequestError('Estado físico no válido');
      }

      const userStr = req.user
        ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email
        : 'Sistema';

      const result = await repo.cambiarEstado(req.params.id, {
        estado_fisico,
        observaciones,
        autorizado_por: userStr,
      });

      if (!result) throw new NotFoundError('Item locativo');
      res.json({ success: true, data: result, message: 'Estado actualizado correctamente' });
    } catch (err) { next(err); }
  },

  // ─── POST /api/inventario/locativo/:id/foto ────────────────
  async subirFoto(req, res, next) {
    try {
      const { id } = req.params;
      if (!req.file) throw new BadRequestError('No se ha subido ninguna foto');

      const item = await repo.findById(id);
      if (!item) throw new NotFoundError('Item locativo');

      // Validar tipo de archivo por magic bytes
      const typeResult = await fileTypeFromBuffer(req.file.buffer);
      if (!typeResult || !['jpg', 'png', 'webp', 'jpeg'].includes(typeResult.ext)) {
        throw new BadRequestError('El archivo debe ser una imagen válida (JPG, PNG o WEBP)');
      }

      const uploadsDir = path.join(getUploadsBasePath(), 'locativo');
      asegurarCarpeta(uploadsDir);

      const mainFilename = `${id}.jpg`;
      const thumbFilename = `${id}_thumb.jpg`;

      const mainPath = path.join(uploadsDir, mainFilename);
      const thumbPath = path.join(uploadsDir, thumbFilename);

      await sharp(req.file.buffer)
        .resize(800, 600, { fit: 'cover' })
        .toFormat('jpeg')
        .jpeg({ quality: 85 })
        .toFile(mainPath);

      await sharp(req.file.buffer)
        .resize(300, 225, { fit: 'cover' })
        .toFormat('jpeg')
        .jpeg({ quality: 85 })
        .toFile(thumbPath);

      const foto_path = `uploads/locativo/${mainFilename}`;
      const foto_url = `/api/v1/inventario/locativo/${id}/foto`;
      const foto_thumb_url = `/api/v1/inventario/locativo/${id}/foto?thumb=true`;

      await repo.update(id, { foto_path, foto_url, foto_thumb_url });

      res.json({
        success: true,
        message: 'Foto subida y procesada correctamente',
        data: { foto_url, foto_thumb_url },
      });
    } catch (err) { next(err); }
  },

  // ─── GET /api/inventario/locativo/:id/foto ─────────────────
  async servirFoto(req, res, next) {
    try {
      const { id } = req.params;
      const thumb = req.query.thumb === 'true';

      const item = await repo.findById(id);
      if (!item) throw new NotFoundError('Item locativo');

      const filename = thumb ? `${id}_thumb.jpg` : `${id}.jpg`;
      const filePath = path.resolve(getUploadsBasePath(), 'locativo', filename);

      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, max-age=86400');
        return res.sendFile(filePath);
      }

      // SVG placeholder
      const grupoLabel = { A: 'Redes', B: 'Obra Civil', C: 'Cerrajería' }[item.grupo_locativo] || 'Locativo';
      const estadoColor = {
        NUEVO: '#22c55e', BUENO: '#3b82f6', REGULAR: '#f59e0b',
        MALO: '#ef4444', DADO_DE_BAJA: '#6b7280',
      }[item.estado_fisico] || '#94a3b8';

      const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" rx="16" fill="url(#bg)" />
  <text x="50%" y="40%" text-anchor="middle" font-size="80" font-family="Segoe UI Emoji, Arial">🏗️</text>
  <text x="50%" y="55%" text-anchor="middle" font-size="32" fill="#f8fafc" font-weight="bold" font-family="Outfit, Inter, sans-serif">${item.nombre}</text>
  <text x="50%" y="65%" text-anchor="middle" font-size="24" fill="#94a3b8" font-family="Outfit, Inter, sans-serif">${grupoLabel} · ${item.subcategoria || ''}</text>
  <text x="50%" y="75%" text-anchor="middle" font-size="18" fill="${estadoColor}" font-family="Outfit, Inter, sans-serif">${item.estado_fisico || 'BUENO'}</text>
</svg>
      `.trim();

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(svgString);
    } catch (err) { next(err); }
  },

  // ─── GET /api/inventario/locativo/resumen-contable ─────────
  async resumenContable(req, res, next) {
    try {
      const resumen = await repo.getResumenContable();
      res.json({ success: true, data: resumen });
    } catch (err) { next(err); }
  },

  // ─── GET /api/inventario/locativo/exportar ─────────────────
  async exportar(req, res, next) {
    try {
      // Obtener todos los items activos
      const result = await repo.findAll({ limit: 10000 });
      const items = result.data;

      // Generar CSV simple (se puede mejorar con exceljs si la dependencia existe)
      const headers = [
        'Código Interno', 'Código Placa', 'Nombre', 'Descripción',
        'Grupo', 'Subcategoría', 'Clasificación Contable', 'Cuenta PUC',
        'Tipo Propiedad', 'Costo Histórico', 'Valor Residual',
        'Vida Útil (años)', 'Fecha Adquisición', 'Método Depreciación',
        'Fecha Fin Contrato', 'Sede', 'Piso/Nivel', 'Área/Oficina',
        'Dirección', 'Estado Físico', 'Responsable',
        'Tipo Documento', 'Número Documento', 'Proveedor',
        'Observaciones', 'Fecha Registro',
      ];

      const csvRows = [headers.join(';')];

      for (const item of items) {
        csvRows.push([
          item.codigo_interno || '',
          item.codigo_placa || '',
          `"${(item.nombre || '').replace(/"/g, '""')}"`,
          `"${(item.descripcion || '').replace(/"/g, '""')}"`,
          item.grupo_locativo || '',
          item.subcategoria || '',
          item.clasificacion_contable || '',
          item.cuenta_contable || '',
          item.tipo_propiedad || '',
          item.costo_historico || '',
          item.valor_residual || '',
          item.vida_util_anios || '',
          item.fecha_adquisicion || '',
          item.metodo_depreciacion || '',
          item.fecha_fin_contrato || '',
          `"${(item.sede || '').replace(/"/g, '""')}"`,
          `"${(item.piso_nivel || '').replace(/"/g, '""')}"`,
          `"${(item.area_oficina_bodega || '').replace(/"/g, '""')}"`,
          `"${(item.direccion_inmueble || '').replace(/"/g, '""')}"`,
          item.estado_fisico || '',
          item.responsable_nombre || '',
          item.tipo_documento_soporte || '',
          item.numero_documento_soporte || '',
          item.proveedor_nombre || '',
          `"${(item.observaciones || '').replace(/"/g, '""')}"`,
          item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '',
        ].join(';'));
      }

      const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM para Excel

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inventario_locativo_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (err) { next(err); }
  },
};
