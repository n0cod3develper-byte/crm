import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TIPOS_PERMITIDOS, MIME_ALIASES, normalizarMimeCliente } from '../services/fileTypeService.js';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function getUploadsBasePath() {
  return process.env.UPLOADS_BASE_PATH || './uploads';
}

export function asegurarCarpeta(ruta) {
  if (!fs.existsSync(ruta)) {
    fs.mkdirSync(ruta, { recursive: true });
  }
}

/**
 * Verifica que una ruta resuelta esté dentro del directorio base de uploads.
 * Previene ataques de path traversal.
 */
export function rutaSegura(rutaRelativa) {
  const base = path.resolve(getUploadsBasePath());
  const ruta = path.resolve(base, rutaRelativa);
  if (!ruta.startsWith(base)) {
    throw new Error('Ruta fuera del directorio permitido');
  }
  return ruta;
}

/**
 * Construye la ruta de upload según entidad y tipo.
 * Ej: empresas/{id}/rut/
 */
export function buildUploadPath(entidadTipo, entidadId, tipoSlug) {
  const carpetaEntidad = {
    EMPRESA: 'empresas',
    PROVEEDOR: 'proveedores',
    OT: 'ordenes_trabajo',
  };
  const base = carpetaEntidad[entidadTipo] || 'general';
  return path.join(base, entidadId.toString(), tipoSlug || 'general').replace(/\\/g, '/');
}

// CAMBIO CLAVE: usar memoryStorage en lugar de diskStorage
// El archivo llega completo en memoria (buffer) antes de guardarlo.
const storage = multer.memoryStorage();

// Pre-filtro por MIME declarado por el cliente (primera defensa)
const fileFilter = (_req, file, cb) => {
  const mimeNormalizado = normalizarMimeCliente(file.mimetype);
  if (TIPOS_PERMITIDOS.includes(mimeNormalizado)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Formato no permitido: ${file.mimetype}. Formatos aceptados: PDF, JPG, PNG, DOCX, XLSX`
      ),
      false
    );
  }
};

// ─── Export middlewares ──────────────────────────────────────────────────────
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
}).single('documento');

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
}).array('documentos', 5);
