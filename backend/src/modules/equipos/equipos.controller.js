import { query, withTransaction } from '../../config/database.js';
import { EquiposRepository } from './equipos.repository.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getUploadsBasePath, asegurarCarpeta } from '../../config/storage.js';
import {
  TIPOS_EQUIPO,
  CAPACIDADES_NOMINALES,
  TIPOS_MASTIL,
  TIPOS_PROPULSION,
  ESTADOS_EQUIPO,
  ESTADOS_REQUIEREN_MOTIVO,
} from '../../constants/equipos.js';

const repo = new EquiposRepository();

const validateFields = (body) => {
  const {
    tipo_equipo,
    capacidad_nominal,
    tipo_mastil,
    altura_maxima,
    tipo_propulsion,
    estado,
    motivo_estado
  } = body;

  const tiposValidos = TIPOS_EQUIPO.map(t => t.valor);
  if (tipo_equipo && !tiposValidos.includes(tipo_equipo)) {
    throw new BadRequestError('Tipo de equipo no válido');
  }

  if (capacidad_nominal) {
    const cap = parseFloat(capacidad_nominal);
    const validCaps = CAPACIDADES_NOMINALES.map(c => c.valor);
    if (!validCaps.includes(cap)) {
      throw new BadRequestError('Capacidad nominal no válida. Valores aceptados: 1.5 a 7.0 en intervalos de 0.5');
    }
  }

  const mastilesValidos = TIPOS_MASTIL.map(m => m.valor);
  if (tipo_mastil && !mastilesValidos.includes(tipo_mastil)) {
    throw new BadRequestError('Tipo de mástil no válido');
  }

  if (altura_maxima) {
    const alt = parseFloat(altura_maxima);
    if (alt < 1.0 || alt > 10.0 || isNaN(alt)) {
      throw new BadRequestError('La altura máxima debe estar entre 1.0 y 10.0 metros');
    }
  }

  const propulsionValida = TIPOS_PROPULSION.map(p => p.valor);
  if (tipo_propulsion && !propulsionValida.includes(tipo_propulsion)) {
    throw new BadRequestError('Tipo de propulsión no válido');
  }

  const estadosValidos = ESTADOS_EQUIPO.map(e => e.valor);
  if (estado) {
    if (!estadosValidos.includes(estado)) {
      throw new BadRequestError('Estado de equipo no válido');
    }
    if (ESTADOS_REQUIEREN_MOTIVO.includes(estado) && (!motivo_estado || !motivo_estado.trim())) {
      throw new BadRequestError(`El motivo es obligatorio para el estado ${estado}`);
    }
  }
};

export const equiposController = {
  async list(req, res, next) {
    try {
      const {
        empresa_id,
        motor,
        combustible,
        capacidad_carga,
        tipo_equipo,
        estado,
        tipo_propulsion,
        ciudad,
        con_foto,
        soat,
        search,
        limit,
        cursor,
        orden
      } = req.query;

      const result = await repo.findAll({
        empresa_id,
        motor,
        combustible,
        capacidad_carga,
        tipo_equipo,
        estado,
        tipo_propulsion,
        ciudad,
        con_foto,
        soat,
        search,
        limit: parseInt(limit) || 50,
        cursor,
        orden
      });

      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const equipo = await repo.findById(req.params.id);
      if (!equipo) throw new NotFoundError('Equipo');
      res.json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { serial } = req.body;
      if (!serial) throw new BadRequestError('El serial es obligatorio');

      const existing = await repo.findBySerial(serial);
      if (existing) throw new BadRequestError(`El serial ${serial} ya está registrado`);

      validateFields(req.body);

      const userStr = req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email : 'Sistema';
      
      const equipo = await repo.create({
        ...req.body,
        actualizado_por: userStr
      });

      res.status(201).json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { serial } = req.body;

      const current = await repo.findById(id);
      if (!current) throw new NotFoundError('Equipo');
      
      if (serial) {
        const existing = await repo.findBySerial(serial);
        if (existing && existing.id !== id) {
          throw new BadRequestError(`El serial ${serial} ya está registrado`);
        }
      }

      validateFields(req.body);

      const userStr = req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email : 'Sistema';

      const equipo = await repo.update(id, {
        ...req.body,
        actualizado_por: userStr
      });

      res.json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const result = await repo.softDelete(req.params.id);
      if (!result) throw new NotFoundError('Equipo');
      res.json({ success: true, message: 'Equipo eliminado correctamente' });
    } catch (err) { next(err); }
  },

  async listByCompany(req, res, next) {
    try {
      const { estado, include_id } = req.query;
      const equipos = await repo.findByCompany(req.params.id, { estado, include_id });
      res.json({ success: true, data: equipos });
    } catch (err) { next(err); }
  },

  async listExternos(req, res, next) {
    try {
      const { search, estado, include_id } = req.query;
      const equipos = await repo.findExternos({ search, estado, include_id });
      res.json({ success: true, data: equipos });
    } catch (err) { next(err); }
  },

  async cambiarEstado(req, res, next) {
    try {
      const { id } = req.params;
      const { estado_nuevo, motivo } = req.body;

      if (!estado_nuevo) throw new BadRequestError('El nuevo estado es obligatorio');
      
      const validEstados = ['OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'ALQUILADO', 'RETIRADO'];
      if (!validEstados.includes(estado_nuevo)) {
        throw new BadRequestError('Estado de equipo no válido');
      }

      if (ESTADOS_REQUIEREN_MOTIVO.includes(estado_nuevo) && (!motivo || !motivo.trim())) {
        throw new BadRequestError(`El motivo es obligatorio para cambiar al estado ${estado_nuevo}`);
      }

      const equipo = await repo.findById(id);
      if (!equipo) throw new NotFoundError('Equipo');

      const estado_anterior = equipo.estado;
      const userStr = req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email : 'Sistema';

      await withTransaction(async (client) => {
        // 1. Actualizar el estado en la tabla equipos
        await client.query(
          `UPDATE equipos SET 
            estado = $1, 
            motivo_estado = $2, 
            fecha_cambio_estado = CURRENT_DATE, 
            updated_at = NOW(),
            actualizado_por = $3
           WHERE id = $4`,
          [estado_nuevo, motivo || null, userStr, id]
        );

        // 2. Insertar historial de estado
        await client.query(
          `INSERT INTO equipos_historial_estado (
            equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por
          ) VALUES ($1, $2, $3, $4, $5)`,
          [id, estado_anterior, estado_nuevo, motivo || null, userStr]
        );
      });

      res.json({ success: true, message: 'Estado actualizado correctamente' });
    } catch (err) { next(err); }
  },

  async actualizarHorometro(req, res, next) {
    try {
      const { id } = req.params;
      const { horometro } = req.body;

      if (horometro === undefined || horometro === null) {
        throw new BadRequestError('El valor del horómetro es obligatorio');
      }

      const nuevoHorometro = parseFloat(horometro);
      if (isNaN(nuevoHorometro) || nuevoHorometro < 0) {
        throw new BadRequestError('El horómetro debe ser un número mayor o igual a 0');
      }

      const equipo = await repo.findById(id);
      if (!equipo) throw new NotFoundError('Equipo');

      const horometroActual = parseFloat(equipo.horometro_actual) || 0;
      if (nuevoHorometro < horometroActual) {
        throw new BadRequestError('El nuevo horómetro no puede ser menor al horómetro actual');
      }

      const userStr = req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email : 'Sistema';

      await repo.update(id, {
        horometro_actual: nuevoHorometro,
        actualizado_por: userStr
      });

      res.json({ success: true, message: 'Horómetro actualizado correctamente' });
    } catch (err) { next(err); }
  },

  async subirFoto(req, res, next) {
    try {
      const { id } = req.params;
      if (!req.file) throw new BadRequestError('No se ha subido ninguna foto');

      const equipo = await repo.findById(id);
      if (!equipo) throw new NotFoundError('Equipo');

      // Validar tipo de archivo por magic bytes
      const typeResult = await fileTypeFromBuffer(req.file.buffer);
      if (!typeResult || !['jpg', 'png', 'webp', 'jpeg'].includes(typeResult.ext)) {
        throw new BadRequestError('El archivo debe ser una imagen válida (JPG, PNG o WEBP)');
      }

      const uploadsDir = path.join(getUploadsBasePath(), 'equipos');
      asegurarCarpeta(uploadsDir);

      const mainFilename = `${id}.jpg`;
      const thumbFilename = `${id}_thumb.jpg`;

      const mainPath = path.join(uploadsDir, mainFilename);
      const thumbPath = path.join(uploadsDir, thumbFilename);

      // Procesar imagen principal: 800x600 px, forzar a jpeg
      await sharp(req.file.buffer)
        .resize(800, 600, { fit: 'cover' })
        .toFormat('jpeg')
        .jpeg({ quality: 85 })
        .toFile(mainPath);

      // Procesar miniatura: 300x225 px, forzar a jpeg
      await sharp(req.file.buffer)
        .resize(300, 225, { fit: 'cover' })
        .toFormat('jpeg')
        .jpeg({ quality: 85 })
        .toFile(thumbPath);

      // Actualizar base de datos con rutas de URL relativas
      const foto_path = `uploads/equipos/${mainFilename}`;
      const foto_url = `/api/v1/equipos/${id}/foto`;
      const foto_thumb_url = `/api/v1/equipos/${id}/foto?thumb=true`;

      const userStr = req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email : 'Sistema';

      await repo.update(id, {
        foto_path,
        foto_url,
        foto_thumb_url,
        actualizado_por: userStr
      });

      res.json({
        success: true,
        message: 'Foto subida y procesada correctamente',
        data: { foto_url, foto_thumb_url }
      });
    } catch (err) { next(err); }
  },

  async servirFoto(req, res, next) {
    try {
      const { id } = req.params;
      const thumb = req.query.thumb === 'true';

      const equipo = await repo.findById(id);
      if (!equipo) throw new NotFoundError('Equipo');

      const filename = thumb ? `${id}_thumb.jpg` : `${id}.jpg`;
      const filePath = path.resolve(getUploadsBasePath(), 'equipos', filename);

      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, max-age=86400');
        return res.sendFile(filePath);
      }

      // Si no existe, servir el placeholder SVG dinámico
      const mapIconos = {
        MONTACARGAS: '🏭',
        ELEVADOR: '⬆️',
        CAMIONETA: '🚐',
        AMBULANCIA: '🚑',
        VEHICULO: '🚗'
      };

      const mapLabels = {
        MONTACARGAS: 'Montacargas',
        ELEVADOR: 'Elevador',
        CAMIONETA: 'Camioneta',
        AMBULANCIA: 'Ambulancia',
        VEHICULO: 'Vehículo'
      };

      const tipo = equipo.tipo_equipo || 'MONTACARGAS';
      const icono = mapIconos[tipo] || '🏭';
      const tipoLabel = mapLabels[tipo] || 'Montacargas';
      const marca = equipo.marca || '';
      const modelo = equipo.modelo || '';

      const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" rx="16" fill="url(#bg)" />
  <text x="50%" y="45%" text-anchor="middle" font-size="120" font-family="Segoe UI Emoji, Apple Color Emoji, Arial, sans-serif">${icono}</text>
  <text x="50%" y="65%" text-anchor="middle" font-size="36" fill="#f8fafc" font-weight="bold" font-family="Outfit, Inter, sans-serif">${tipoLabel}</text>
  <text x="50%" y="75%" text-anchor="middle" font-size="28" fill="#94a3b8" font-family="Outfit, Inter, sans-serif">${marca} ${modelo}</text>
</svg>
      `.trim();

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(svgString);
    } catch (err) { next(err); }
  },

  async eliminarFoto(req, res, next) {
    try {
      const { id } = req.params;
      const equipo = await repo.findById(id);
      if (!equipo) throw new NotFoundError('Equipo');

      if (equipo.foto_path) {
        const uploadsDir = path.join(getUploadsBasePath(), 'equipos');
        const mainPath = path.join(uploadsDir, `${id}.jpg`);
        const thumbPath = path.join(uploadsDir, `${id}_thumb.jpg`);

        try {
          if (fs.existsSync(mainPath)) fs.unlinkSync(mainPath);
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        } catch (fileErr) {
          // Si hay algún error eliminando archivos (p.ej. permisos), lo registramos pero continuamos
          console.error('Error unlinking files', fileErr);
        }
      }

      const userStr = req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email : 'Sistema';

      await repo.update(id, {
        foto_path: null,
        foto_url: null,
        foto_thumb_url: null,
        actualizado_por: userStr
      });

      res.json({ success: true, message: 'Foto eliminada correctamente' });
    } catch (err) { next(err); }
  },

  async historialEstado(req, res, next) {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;

      const result = await repo.findStateHistory(id, {
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0
      });

      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
};

