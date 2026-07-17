import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { detectarTipoReal } from './fileTypeService.js';

const BASE_PATH = process.env.UPLOADS_BASE_PATH || './uploads';

/**
 * Guarda un archivo en disco con extensión correcta según tipo real detectado por magic bytes.
 * Flujo:
 * 1. Detectar tipo real del buffer con file-type (magic bytes).
 * 2. Validar que el tipo es permitido.
 * 3. Escribir buffer en disco con la extensión correcta.
 * 4. Retornar metadata completa del archivo guardado.
 *
 * @param {string} tempFilePath   - Ruta del archivo temporal subido
 * @param {string} carpetaRel     - Ruta relativa. Ej: 'empresas/uuid/rut'
 * @param {string} nombreOriginal - Nombre original del usuario
 * @returns {Promise<object>} Metadata del archivo guardado
 */
export async function guardarArchivo(tempFilePath, carpetaRel, nombreOriginal) {
  const buffer = fs.readFileSync(tempFilePath);
  // Paso 1: Detectar tipo REAL por magic bytes antes de escribir nada
  const tipoDetectado = await detectarTipoReal(buffer);

  // Paso 2: Si el tipo no es válido, rechazar antes de escribir en disco
  if (!tipoDetectado.valido) {
    throw new Error(tipoDetectado.error || 'Tipo de archivo no permitido');
  }

  // Paso 3: Construir ruta final con extensión correcta
  const carpetaAbs = path.join(BASE_PATH, carpetaRel);
  fs.mkdirSync(carpetaAbs, { recursive: true });

  const idArchivo = uuidv4();
  const nombreDisco = `${idArchivo}.${tipoDetectado.ext}`;
  const rutaFinal = path.join(carpetaAbs, nombreDisco);

  // Paso 4: Copiar (funciona entre diferentes filesystems en Docker)
  // Usamos copyFileSync + unlinkSync en lugar de renameSync porque
  // renameSync falla con EXDEV (Cross-device link) cuando /tmp y el destino
  // están en sistemas de archivos diferentes (común en contenedores Docker).
  try {
    fs.renameSync(tempFilePath, rutaFinal);
  } catch (renameErr) {
    if (renameErr.code === 'EXDEV') {
      // Fallback: copiar y eliminar
      fs.copyFileSync(tempFilePath, rutaFinal);
      fs.unlinkSync(tempFilePath);
    } else {
      throw renameErr;
    }
  }

  const stats = fs.statSync(rutaFinal);

  return {
    nombreDisco,                                                    // uuid.pdf
    rutaRelativa: path.join(carpetaRel, nombreDisco).replace(/\\/g, '/'),
    mime: tipoDetectado.mime,                                       // application/pdf
    ext: tipoDetectado.ext,                                         // pdf
    formato: tipoDetectado.ext,                                     // pdf (lowercase)
    tamanoBytes: stats.size,
    esVisualizableInline: tipoDetectado.config.esVisualizableInline,
    esImagen: tipoDetectado.config.esImagen,
    nombreOriginal,
  };
}

/**
 * Elimina un archivo del disco de forma segura.
 * Verifica que la ruta esté dentro del BASE_PATH (anti path traversal).
 */
export function eliminarArchivo(rutaRelativa) {
  const base = path.resolve(BASE_PATH);
  const absoluta = path.resolve(base, rutaRelativa);

  if (!absoluta.startsWith(base)) {
    throw new Error('Ruta fuera del directorio permitido');
  }

  if (fs.existsSync(absoluta)) {
    fs.unlinkSync(absoluta);
    return true;
  }
  return false;
}
