import { Router } from 'express';
import { documentoService } from '../../services/documentoService.js';
import { uploadSingle, uploadMultiple, buildUploadPath, rutaSegura, getUploadsBasePath } from '../../config/storage.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { query } from '../../config/database.js';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

// ─── Tipos de documento ──────────────────────────────────────────────────────

// GET /api/documentos/tipos?aplica_a=EMPRESA
router.get('/tipos', async (req, res, next) => {
  try {
    const { aplica_a } = req.query;
    let sql = 'SELECT * FROM tipos_documento WHERE activo = TRUE';
    const params = [];
    if (aplica_a) {
      sql += ` AND (aplica_a = $1 OR aplica_a = 'AMBOS')`;
      params.push(aplica_a);
    }
    sql += ' ORDER BY orden ASC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// ─── Ver / Descargar documento ──────────────────────────────────────────────

// GET /api/documentos/:id/ver
router.get('/:id/ver', async (req, res, next) => {
  try {
    const doc = await documentoService.obtenerDocumento(req.params.id);
    if (!doc || doc.estado === 'ELIMINADO') {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const absolutePath = rutaSegura(doc.ruta_relativa);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en disco' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(absolutePath);
  } catch (err) { next(err); }
});

// GET /api/documentos/:id/descargar
router.get('/:id/descargar', async (req, res, next) => {
  try {
    const doc = await documentoService.obtenerDocumento(req.params.id);
    if (!doc || doc.estado === 'ELIMINADO') {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const absolutePath = rutaSegura(doc.ruta_relativa);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en disco' });
    }

    // Construir nombre de descarga: nombre_original con extensión correcta
    const extCorrecta = doc.formato?.toLowerCase() || 'bin';
    const nombreBase  = doc.nombre_original.replace(/\.[^/.]+$/, ''); // quitar ext
    const nombreDescarga = `${nombreBase}.${extCorrecta}`;
    const nombreSanitizado = nombreDescarga.replace(/[^\w\s.\-()]/g, '_');

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreSanitizado}"; filename*=UTF-8''${encodeURIComponent(nombreSanitizado)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(absolutePath);
  } catch (err) { next(err); }
});

// ─── Documentos por entidad ─────────────────────────────────────────────────

// GET /api/documentos/entidad/:tipo/:id
router.get('/entidad/:tipo/:entidadId', async (req, res, next) => {
  try {
    const { tipo, entidadId } = req.params;
    const filtros = { tipo: req.query.tipo_slug };
    const result = await documentoService.listarDocumentos(tipo, entidadId, filtros);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/documentos/completitud/:tipo/:id
router.get('/completitud/:tipo/:entidadId', async (req, res, next) => {
  try {
    const { tipo, entidadId } = req.params;
    const result = await documentoService.verificarCompletitud(tipo, entidadId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/documentos/entidad/:tipo/:id
router.post('/entidad/:tipo/:entidadId', uploadLimiter, (req, res, next) => {
  const { tipo, entidadId } = req.params;
  const tipoSlug = req.query.tipo_slug || 'general';

  // Configurar la ruta de upload antes de que multer lo use
  req.uploadPath = buildUploadPath(tipo, entidadId, tipoSlug);

  uploadMultiple(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'El archivo excede el tamaño máximo de 10MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se recibió ningún archivo' });
      }

      const datos = {
        tipo_documento_id: req.body.tipo_documento_id || null,
        nombre_display: req.body.nombre_display,
        descripcion: req.body.descripcion,
        fecha_documento: req.body.fecha_documento,
        fecha_vencimiento: req.body.fecha_vencimiento,
        es_confidencial: req.body.es_confidencial === 'true',
      };

      const results = await documentoService.subirMultiples(
        tipo, entidadId, req.files, datos, req.user?.id || 'system', req.uploadPath
      );

      res.status(201).json({ success: true, data: results });
    } catch (error) {
      if (error.message.includes('no permitido') || error.message.includes('identificar')) {
        return res.status(422).json({ error: error.message });
      }
      next(error);
    }
  });
});

// POST /api/documentos/entidad/:tipo/:id/single
router.post('/entidad/:tipo/:entidadId/single', uploadLimiter, (req, res, next) => {
  const { tipo, entidadId } = req.params;
  const tipoSlug = req.query.tipo_slug || 'general';

  req.uploadPath = buildUploadPath(tipo, entidadId, tipoSlug);

  uploadSingle(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'El archivo excede el tamaño máximo de 10MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo' });
      }

      const datos = {
        tipo_documento_id: req.body.tipo_documento_id || null,
        nombre_display: req.body.nombre_display || req.file.originalname,
        descripcion: req.body.descripcion,
        fecha_documento: req.body.fecha_documento,
        fecha_vencimiento: req.body.fecha_vencimiento,
        es_confidencial: req.body.es_confidencial === 'true',
      };

      const doc = await documentoService.subirDocumento(
        tipo, entidadId, req.file, datos, req.user?.id || 'system', req.uploadPath
      );

      res.status(201).json({ success: true, data: doc });
    } catch (error) {
      if (error.message.includes('no permitido') || error.message.includes('identificar')) {
        return res.status(422).json({ error: error.message });
      }
      next(error);
    }
  });
});

// DELETE /api/documentos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const permanente = req.query.permanente === 'true';
    const doc = await documentoService.eliminarDocumento(req.params.id, permanente);
    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({ success: true, message: 'Documento eliminado' });
  } catch (err) { next(err); }
});

// ─── Admin: CRUD tipos de documento ─────────────────────────────────────────

// GET /api/documentos/admin/tipos
router.get('/admin/tipos', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM tipos_documento ORDER BY orden ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/documentos/admin/tipos
router.post('/admin/tipos', async (req, res, next) => {
  try {
    const { nombre, slug, aplica_a, es_obligatorio, descripcion, orden } = req.body;
    const result = await query(`
      INSERT INTO tipos_documento (nombre, slug, aplica_a, es_obligatorio, descripcion, orden)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [nombre, slug, aplica_a, es_obligatorio || false, descripcion || null, orden || 0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un tipo de documento con ese slug' });
    }
    next(err);
  }
});

// PUT /api/documentos/admin/tipos/:id
router.put('/admin/tipos/:id', async (req, res, next) => {
  try {
    const { nombre, slug, aplica_a, es_obligatorio, descripcion, orden, activo } = req.body;
    const result = await query(`
      UPDATE tipos_documento
      SET nombre = $1, slug = $2, aplica_a = $3, es_obligatorio = $4,
          descripcion = $5, orden = $6, activo = $7
      WHERE id = $8 RETURNING *
    `, [nombre, slug, aplica_a, es_obligatorio, descripcion, orden, activo, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tipo de documento no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/documentos/admin/tipos/:id/estado
router.patch('/admin/tipos/:id/estado', async (req, res, next) => {
  try {
    const { activo } = req.body;
    const result = await query(
      'UPDATE tipos_documento SET activo = $1 WHERE id = $2 RETURNING *',
      [activo, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tipo de documento no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─── OT Firmada ─────────────────────────────────────────────────────────────

// POST /api/documentos/ot/:id/firmada
router.post('/ot/:otId/firmada', uploadLimiter, (req, res, next) => {
  const { otId } = req.params;
  req.uploadPath = buildUploadPath('OT', otId, 'firmadas');

  uploadSingle(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió el archivo' });
      }

      // Verificar que la OT existe y no está liquidada
      const otRes = await query('SELECT * FROM ordenes_trabajo WHERE id = $1', [otId]);
      if (otRes.rows.length === 0) {
        return res.status(404).json({ error: 'OT no encontrada' });
      }
      const ot = otRes.rows[0];
      if (ot.estado === 'LIQUIDADA' || ot.estado === 'CERRADA') {
        return res.status(422).json({ error: 'No se puede subir OT firmada a una OT ya liquidada/cerrada' });
      }

      // Archivar la anterior si existe
      if (ot.ot_firmada_doc_id) {
        await documentoService.archivarDocumento(ot.ot_firmada_doc_id);
      }

      // Buscar tipo_documento 'ot_firmada'
      const tipoRes = await query("SELECT id FROM tipos_documento WHERE slug = 'ot_firmada'");
      const tipoId = tipoRes.rows[0]?.id || null;

      // Subir
      const doc = await documentoService.subirDocumento('OT', otId, req.file, {
        tipo_documento_id: tipoId,
        nombre_display: `OT Firmada ${ot.consecutivo}`,
        descripcion: 'Orden de trabajo firmada por el cliente',
      }, req.user?.id || 'system', req.uploadPath);

      // Actualizar la OT con el nuevo doc
      await query(
        'UPDATE ordenes_trabajo SET ot_firmada_doc_id = $1, updated_at = NOW() WHERE id = $2',
        [doc.id, otId]
      );

      res.status(201).json({
        success: true,
        data: doc,
        message: 'OT firmada subida. La liquidación está habilitada.',
      });
    } catch (error) {
      if (error.message.includes('no permitido') || error.message.includes('identificar')) {
        return res.status(422).json({ error: error.message });
      }
      next(error);
    }
  });
});

// GET /api/documentos/ot/:id/firmada
router.get('/ot/:otId/firmada', async (req, res, next) => {
  try {
    const otRes = await query('SELECT ot_firmada_doc_id, consecutivo FROM ordenes_trabajo WHERE id = $1', [req.params.otId]);
    if (otRes.rows.length === 0) {
      return res.status(404).json({ error: 'OT no encontrada' });
    }
    const ot = otRes.rows[0];
    if (!ot.ot_firmada_doc_id) {
      return res.json({ success: true, data: null, message: 'OT sin firma subida' });
    }
    const doc = await documentoService.obtenerDocumento(ot.ot_firmada_doc_id);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
});

// DELETE /api/documentos/ot/:id/firmada
router.delete('/ot/:otId/firmada', async (req, res, next) => {
  try {
    const otRes = await query('SELECT ot_firmada_doc_id FROM ordenes_trabajo WHERE id = $1', [req.params.otId]);
    if (otRes.rows.length === 0) return res.status(404).json({ error: 'OT no encontrada' });

    const ot = otRes.rows[0];
    if (ot.ot_firmada_doc_id) {
      await documentoService.archivarDocumento(ot.ot_firmada_doc_id);
      await query(
        'UPDATE ordenes_trabajo SET ot_firmada_doc_id = NULL, updated_at = NOW() WHERE id = $1',
        [req.params.otId]
      );
    }

    res.json({ success: true, message: 'OT firmada eliminada' });
  } catch (err) { next(err); }
});

// ─── Check puede liquidar ───────────────────────────────────────────────────
router.get('/ot/:otId/puede-liquidar', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM ot_puede_liquidar WHERE id = $1',
      [req.params.otId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'OT no encontrada' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
