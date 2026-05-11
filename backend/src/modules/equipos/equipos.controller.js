import { EquiposRepository } from './equipos.repository.js';
import { HistorialRepository } from './historial.repository.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'historial');

// Garantizar que la carpeta de uploads exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Configuración Multer ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf|mp4|mov|avi/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido'));
};

// ─── Sanitizar datos de FormData (strings → tipos correctos) ──
function sanitizeHistorialData(body) {
  const boolFields  = ['ot_cerrada'];
  const floatFields = ['horometro_al_ingreso', 'costo_total_mantenimiento'];
  const nullableStr = [
    'orden_trabajo_id','numero_ot','nivel_criticidad','causa_raiz',
    'fallas_encontradas','trabajos_realizados','observaciones_seguridad',
    'fecha_hora_ingreso_taller','fecha_hora_salida_taller',
    'fecha_inicio_bodega','fecha_fin_bodega',
    'estado_equipo_al_cierre','proxima_fecha_mantenimiento','supervisor_id',
  ];
  const out = { ...body };
  for (const f of boolFields)  { if (f in out) out[f] = out[f] === 'true' || out[f] === true; }
  for (const f of floatFields) { if (f in out && out[f] !== '') out[f] = parseFloat(out[f]) || 0; }
  for (const f of nullableStr) { if (f in out && out[f] === '') out[f] = null; }
  // Parsear trabajos_detalle desde JSON string (viene de FormData)
  if ('trabajos_detalle' in out && typeof out.trabajos_detalle === 'string') {
    try { out.trabajos_detalle = JSON.parse(out.trabajos_detalle); }
    catch { out.trabajos_detalle = []; }
  }
  return out;
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB por archivo
}).array('adjuntos', 10);

// ─── Instancias de repositorios ──────────────────────────────
const repo = new EquiposRepository();
const historialRepo = new HistorialRepository();

export const equiposController = {

  // ─── CRUD Equipos ─────────────────────────────────────────
  async list(req, res, next) {
    try {
      const { empresa_id, motor, combustible, capacidad_carga, search, limit, cursor } = req.query;
      const result = await repo.findAll({
        empresa_id, motor, combustible, capacidad_carga, search,
        limit: parseInt(limit) || 50, cursor,
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
      if (!serial) throw new BadRequestError('El campo serial es obligatorio');
      const existing = await repo.findBySerial(serial);
      if (existing) throw new BadRequestError(`El serial ${serial} ya está registrado`);

      const equipo = await repo.create(req.body);
      res.status(201).json({ success: true, data: equipo });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { serial } = req.body;

      if (serial) {
        const existing = await repo.findBySerial(serial);
        if (existing && existing.id !== id) throw new BadRequestError(`El serial ${serial} ya está registrado`);
      }

      const equipo = await repo.update(id, req.body);
      if (!equipo) throw new NotFoundError('Equipo');
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
      const equipos = await repo.findByCompany(req.params.id);
      res.json({ success: true, data: equipos });
    } catch (err) { next(err); }
  },

  // ─── Historial ────────────────────────────────────────────
  async listHistorial(req, res, next) {
    try {
      const { tipo_mantenimiento, fecha_desde, fecha_hasta, estado_equipo_al_cierre } = req.query;
      const data = await historialRepo.findAll(req.params.id, {
        tipo_mantenimiento, fecha_desde, fecha_hasta, estado_equipo_al_cierre,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getHistorial(req, res, next) {
    try {
      const item = await historialRepo.findById(req.params.id, req.params.historialId);
      if (!item) throw new NotFoundError('Registro de historial');
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async createHistorial(req, res, next) {
    try {
      const raw = sanitizeHistorialData(req.body);
      const { tipo_mantenimiento } = raw;
      if (!tipo_mantenimiento) throw new BadRequestError('tipo_mantenimiento es requerido');

      // Adjuntos subidos vía multer
      const adjuntosNuevos = (req.files || []).map(f => `/uploads/historial/${f.filename}`);
      const bodyAdjuntos = raw.adjuntos
        ? (Array.isArray(raw.adjuntos) ? raw.adjuntos : [raw.adjuntos])
        : [];

      const data = {
        ...raw,
        adjuntos: [...bodyAdjuntos, ...adjuntosNuevos],
        tecnicos_ids: raw.tecnicos_ids
          ? (Array.isArray(raw.tecnicos_ids) ? raw.tecnicos_ids : [raw.tecnicos_ids])
          : [],
        repuestos: raw.repuestos
          ? (typeof raw.repuestos === 'string' ? JSON.parse(raw.repuestos) : raw.repuestos)
          : [],
      };

      const item = await historialRepo.create(req.params.id, data, req.user.id);
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async updateHistorial(req, res, next) {
    try {
      const raw = sanitizeHistorialData(req.body);
      const adjuntosNuevos = (req.files || []).map(f => `/uploads/historial/${f.filename}`);
      const bodyAdjuntos = raw.adjuntos
        ? (Array.isArray(raw.adjuntos) ? raw.adjuntos : [raw.adjuntos])
        : [];

      const data = {
        ...raw,
        adjuntos: [...bodyAdjuntos, ...adjuntosNuevos],
        tecnicos_ids: raw.tecnicos_ids
          ? (Array.isArray(raw.tecnicos_ids) ? raw.tecnicos_ids : [raw.tecnicos_ids])
          : undefined,
      };

      const item = await historialRepo.update(req.params.historialId, data);
      if (!item) throw new NotFoundError('Registro de historial');
      res.json({ success: true, data: item });
    } catch (err) {
      if (err.message === 'OT_CERRADA') {
        return next(new ForbiddenError('No se puede editar un registro con OT cerrada'));
      }
      next(err);
    }
  },

  async addRepuestos(req, res, next) {
    try {
      const repuestos = Array.isArray(req.body) ? req.body : [req.body];
      const items = await historialRepo.addRepuestos(req.params.historialId, repuestos);
      res.status(201).json({ success: true, data: items });
    } catch (err) {
      if (err.message === 'OT_CERRADA') {
        return next(new ForbiddenError('No se puede editar un registro con OT cerrada'));
      }
      next(err);
    }
  },

  async getTecnicosDisponibles(req, res, next) {
    try {
      const data = await historialRepo.findTecnicosDisponibles();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
