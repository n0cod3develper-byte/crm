import { query, withTransaction } from '../config/database.js';
import { getUploadsBasePath, rutaSegura } from '../config/storage.js';
import { guardarArchivo, eliminarArchivo } from './fileStorageService.js';
import fs from 'fs';
import path from 'path';

/**
 * Servicio compartido de gestión documental.
 * Usado por controladores de Empresas, Proveedores y OT.
 */
export class DocumentoService {

  /**
   * Listar documentos de una entidad, agrupados por tipo_documento.
   */
  async listarDocumentos(entidadTipo, entidadId, filtros = {}) {
    const params = [entidadTipo, entidadId];
    let i = 3;

    let extraCondition = '';
    if (entidadTipo === 'EMPRESA') {
      // Si la entidad es una EMPRESA, también queremos listar las OT firmadas
      // que estén vinculadas a Órdenes de Trabajo de esta empresa.
      extraCondition = `
        OR (d.entidad_tipo = 'OT' AND d.entidad_id IN (
          SELECT id FROM ordenes_trabajo WHERE empresa_id = $2::uuid
        ) AND td.slug = 'ot_firmada')
      `;
    }

    if (filtros.tipo) {
      params.push(filtros.tipo);
    }

    const sql = `
      SELECT
        d.id, d.nombre_display, d.nombre_original, d.descripcion,
        d.formato, d.tamano_bytes, d.tiene_thumb,
        d.fecha_documento, d.fecha_vencimiento,
        d.es_confidencial, d.subido_por, d.created_at,
        d.ruta_relativa, d.nombre_disco, d.mime_type, d.es_visualizable_inline,
        td.nombre AS tipo_documento_nombre,
        td.slug AS tipo_documento_slug,
        td.orden AS tipo_orden
      FROM documentos d
      LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id
      WHERE ( (d.entidad_tipo = $1 AND d.entidad_id = $2::uuid) ${extraCondition} )
        AND d.estado = 'ACTIVO'
        ${filtros.tipo ? `AND td.slug = $${i++}` : ''}
      ORDER BY td.orden ASC, d.created_at DESC
    `;

    const result = await query(sql, params);

    // Agrupar por tipo
    const grouped = {};
    for (const row of result.rows) {
      const key = row.tipo_documento_slug || 'sin_tipo';
      if (!grouped[key]) {
        grouped[key] = {
          tipo_nombre: row.tipo_documento_nombre || 'Sin tipo',
          tipo_slug: key,
          documentos: [],
        };
      }
      grouped[key].documentos.push(row);
    }

    return {
      total: result.rows.length,
      grupos: Object.values(grouped),
      documentos: result.rows,
    };
  }

  /**
   * Obtener los tipos de documento aplicables a un tipo de entidad.
   */
  async obtenerTiposDocumento(entidadTipo) {
    const result = await query(
      `SELECT * FROM tipos_documento
       WHERE activo = TRUE AND (aplica_a = $1 OR aplica_a = 'AMBOS')
       ORDER BY orden ASC`,
      [entidadTipo]
    );
    return result.rows;
  }

  /**
   * Verificar completitud documental (obligatorios).
   */
  async verificarCompletitud(entidadTipo, entidadId) {
    const obligatorios = await query(
      `SELECT td.id, td.nombre, td.slug,
              EXISTS(
                SELECT 1 FROM documentos d
                WHERE d.tipo_documento_id = td.id
                  AND d.entidad_tipo = $1
                  AND d.entidad_id = $2
                  AND d.estado = 'ACTIVO'
              ) AS cumplido
       FROM tipos_documento td
       WHERE td.es_obligatorio = TRUE
         AND td.activo = TRUE
         AND (td.aplica_a = $1 OR td.aplica_a = 'AMBOS')
       ORDER BY td.orden ASC`,
      [entidadTipo, entidadId]
    );

    const total = obligatorios.rows.length;
    const cumplidos = obligatorios.rows.filter(r => r.cumplido).length;

    return {
      total,
      cumplidos,
      porcentaje: total > 0 ? Math.round((cumplidos / total) * 100) : 100,
      detalle: obligatorios.rows,
    };
  }

  /**
   * Subir un documento.
   * @param {object} file - Objeto de multer (path, filename, originalname, mimetype, size)
   * @param {object} datos - { tipo_documento_id, nombre_display, descripcion, fecha_documento, fecha_vencimiento, es_confidencial }
   */
  async subirDocumento(entidadTipo, entidadId, file, datos, userId, carpetaRel) {
    const fileMeta = await guardarArchivo(file.buffer, carpetaRel, file.originalname);

    const result = await query(`
      INSERT INTO documentos (
        tipo_documento_id, entidad_tipo, entidad_id,
        nombre_original, nombre_disco, ruta_relativa, nombre_display,
        descripcion, formato, tamano_bytes, tiene_thumb,
        es_confidencial, subido_por, fecha_documento, fecha_vencimiento,
        mime_type, es_visualizable_inline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      datos.tipo_documento_id || null,
      entidadTipo,
      entidadId,
      fileMeta.nombreOriginal,
      fileMeta.nombreDisco,
      fileMeta.rutaRelativa,
      datos.nombre_display || fileMeta.nombreOriginal,
      datos.descripcion || null,
      fileMeta.formato.toUpperCase(),
      fileMeta.tamanoBytes,
      false, // tiene_thumb — se puede generar async
      datos.es_confidencial || false,
      userId,
      datos.fecha_documento || null,
      datos.fecha_vencimiento || null,
      fileMeta.mime,
      fileMeta.esVisualizableInline
    ]);

    return result.rows[0];
  }

  /**
   * Subir múltiples documentos.
   */
  async subirMultiples(entidadTipo, entidadId, files, datos, userId, carpetaRel) {
    const results = [];
    for (const file of files) {
      const doc = await this.subirDocumento(entidadTipo, entidadId, file, datos, userId, carpetaRel);
      results.push(doc);
    }
    return results;
  }

  /**
   * Eliminar documento (soft delete o permanente).
   */
  async eliminarDocumento(docId, permanente = false) {
    // Buscar documento
    const docRes = await query('SELECT * FROM documentos WHERE id = $1', [docId]);
    const doc = docRes.rows[0];
    if (!doc) return null;

    // Soft delete siempre
    await query(
      "UPDATE documentos SET estado = 'ELIMINADO', updated_at = NOW() WHERE id = $1",
      [docId]
    );

    // Si permanente: eliminar de disco
    if (permanente) {
      try {
        eliminarArchivo(doc.ruta_relativa);
        // Eliminar thumbnail si existe
        if (doc.tiene_thumb) {
          const thumbName = `${path.parse(doc.nombre_disco).name}_thumb.jpg`;
          const thumbPath = path.join(getUploadsBasePath(), 'thumbs', thumbName);
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
          }
        }
      } catch (err) {
        console.error('Error al eliminar archivo de disco:', err.message);
      }
    }

    return doc;
  }

  /**
   * Obtener datos de un documento por ID.
   */
  async obtenerDocumento(docId) {
    const result = await query(
      `SELECT d.*, td.nombre AS tipo_nombre, td.slug AS tipo_slug
       FROM documentos d
       LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id
       WHERE d.id = $1`,
      [docId]
    );
    return result.rows[0] || null;
  }

  /**
   * Archivar documento.
   */
  async archivarDocumento(docId) {
    await query(
      "UPDATE documentos SET estado = 'ARCHIVADO', updated_at = NOW() WHERE id = $1",
      [docId]
    );
  }
}

export const documentoService = new DocumentoService();
