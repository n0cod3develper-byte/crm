import { CatalogRepository } from './catalog.repository.js';
import { NotFoundError } from '../../utils/errors.js';
import { uploadSingle, buildUploadPath } from '../../config/storage.js';
import { guardarArchivo } from '../../services/fileStorageService.js';
import { logger } from '../../utils/logger.js';

const repo = new CatalogRepository();

/**
 * Map legacy frontend field names to current DB column names.
 * After migration 019, unit_cost → costo_reposicion, stock_current → stock_actual.
 */
function mapFrontendFields(body) {
  const data = { ...body };
  if ('unit_cost' in data) {
    data.costo_reposicion = data.unit_cost;
    delete data.unit_cost;
  }
  if ('stock_current' in data) {
    data.stock_actual = data.stock_current;
    delete data.stock_current;
  }
  return data;
}

export const getItems = async (req, res, next) => {
  try {
    const filters = req.query;
    const result = await repo.findAll(filters);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const getItem = async (req, res, next) => {
  try {
    const item = await repo.findById(req.params.id);
    if (!item) throw new NotFoundError('Item de catálogo');
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

export const buscarItems = async (req, res, next) => {
  try {
    const { q, tipo, limit } = req.query;
    const items = await repo.getSearch(q, tipo, limit);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

export const getAlertas = async (req, res, next) => {
  try {
    const alertas = await repo.getAlertas();
    res.json({ success: true, data: alertas });
  } catch (err) { next(err); }
};

export const getCategorias = async (req, res, next) => {
  try {
    const categorias = await repo.getCategorias();
    res.json({ success: true, data: categorias });
  } catch (err) { next(err); }
};

export const getUnidades = async (req, res, next) => {
  try {
    const unidades = await repo.getUnidadesMedida();
    res.json({ success: true, data: unidades });
  } catch (err) { next(err); }
};

export const createItem = async (req, res, next) => {
  try {
    logger.debug('[CatalogController] Creating item', { userId: req.user?.id });
    const item = await repo.create(mapFrontendFields(req.body), req.user.id);
    res.status(201).json({ success: true, data: item });
  } catch (err) { 
    logger.error('[CatalogController] Error creating item', { error: err.message });
    next(err); 
  }
};

export const updateItem = async (req, res, next) => {
  try {
    const item = await repo.update(req.params.id, mapFrontendFields(req.body), req.user.id);
    if (!item) throw new NotFoundError('Item de catálogo');
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

export const patchStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nuevo_stock, motivo } = req.body;
    if (nuevo_stock === undefined || isNaN(nuevo_stock) || Number(nuevo_stock) < 0) {
  return res.status(422).json({ success: false, message: 'nuevo_stock debe ser un número no negativo' });
}
const item = await repo.adjustStock(id, Number(nuevo_stock), req.user.id, motivo);
if (!item) throw new NotFoundError('Item de catálogo');
res.json({ success: true, data: item });
} catch (err) {
  next(err);
}
};


export const deleteItem = async (req, res, next) => {
  try {
    await repo.delete(req.params.id);
    res.json({ success: true, message: 'Item eliminado del catálogo' });
  } catch (err) {
    next(err);
  }
};

export const uploadImagen = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      logger.warn('uploadImagen: No se recibió archivo en req.file', { id });
      return res.status(400).json({ 
        success: false, 
        message: 'No se recibió el archivo en el campo "documento". Verifique el FormData del frontend.'
      });
    }

    // 1. Preparar la ruta de subida
    const uploadPath = buildUploadPath('CATALOGO', id, 'imagenes');

    // 2. Guardar físicamente
    const fileMeta = await guardarArchivo(req.file.path, uploadPath, req.file.originalname);

    // 3. Actualizar base de datos
    const item = await repo.update(id, { 
      imagen_url: fileMeta.rutaRelativa,
      imagen_thumb_url: fileMeta.rutaRelativa 
    }, req.user.id);

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('Error en uploadImagen', { error: error.message, id });
    next(error);
  }
};

// --- Categorías ---

export const createCategoria = async (req, res, next) => {
  try {
    const cat = await repo.createCategoria(req.body);
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
};

export const updateCategoria = async (req, res, next) => {
  try {
    const cat = await repo.updateCategoria(req.params.id, req.body);
    if (!cat) throw new NotFoundError('Categoría de catálogo');
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
};

export const deleteCategoria = async (req, res, next) => {
  try {
    await repo.deleteCategoria(req.params.id);
    res.json({ success: true, message: 'Familia eliminada correctamente' });
  } catch (err) { next(err); }
};
