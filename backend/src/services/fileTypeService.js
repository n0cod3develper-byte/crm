import { fileTypeFromBuffer } from 'file-type';

// ─── Mapa de MIME types permitidos con sus propiedades ───────────────────────
export const MIME_CONFIG = {
  'application/pdf': {
    ext: 'pdf',
    label: 'PDF',
    esVisualizableInline: true,
    esImagen: false,
    contentDisposition: 'inline',
  },
  'image/jpeg': {
    ext: 'jpg',
    label: 'Imagen JPG',
    esVisualizableInline: true,
    esImagen: true,
    contentDisposition: 'inline',
  },
  'image/png': {
    ext: 'png',
    label: 'Imagen PNG',
    esVisualizableInline: true,
    esImagen: true,
    contentDisposition: 'inline',
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    label: 'Word',
    esVisualizableInline: false,
    esImagen: false,
    contentDisposition: 'attachment',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: 'xlsx',
    label: 'Excel',
    esVisualizableInline: false,
    esImagen: false,
    contentDisposition: 'attachment',
  },
};

// MIME aliases que el OS o browser pueden enviar como variante
export const MIME_ALIASES = {
  'image/jpg':              'image/jpeg',
  'application/x-pdf':      'application/pdf',
  'application/msword':     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const TIPOS_PERMITIDOS = Object.keys(MIME_CONFIG);

/**
 * Detecta el tipo REAL de un archivo leyendo sus magic bytes desde un Buffer.
 * @param {Buffer} buffer - Buffer del contenido del archivo
 * @returns {{ mime, ext, config, valido, error }}
 */
export async function detectarTipoReal(buffer) {
  try {
    const resultado = await fileTypeFromBuffer(buffer);

    if (!resultado) {
      return {
        mime: 'application/octet-stream',
        ext: 'bin',
        config: null,
        valido: false,
        error: 'No se pudo identificar el tipo del archivo por sus bytes',
      };
    }

    // Normalizar alias
    const mimeCanonicho = MIME_ALIASES[resultado.mime] || resultado.mime;
    const config = MIME_CONFIG[mimeCanonicho];

    if (!config) {
      return {
        mime: mimeCanonicho,
        ext: resultado.ext,
        config: null,
        valido: false,
        error: `Tipo de archivo no permitido: ${mimeCanonicho} (${resultado.ext})`,
      };
    }

    return {
      mime: mimeCanonicho,
      ext: config.ext,
      config,
      valido: true,
      error: null,
    };
  } catch (err) {
    return {
      mime: 'application/octet-stream',
      ext: 'bin',
      config: null,
      valido: false,
      error: `Error leyendo el archivo: ${err.message}`,
    };
  }
}

/**
 * Normaliza un MIME type declarado por el cliente.
 */
export function normalizarMimeCliente(mimeCliente) {
  return MIME_ALIASES[mimeCliente] || mimeCliente;
}
