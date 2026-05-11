import { CatalogRepository } from './catalog.repository.js';
import { NotFoundError } from '../../utils/errors.js';
import { uploadSingle, buildUploadPath } from '../../config/storage.js';
import { guardarArchivo } from '../../services/fileStorageService.js';

const repo = new CatalogRepository();

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
    const item = await repo.create(req.body, req.user.id);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
};

export const updateItem = async (req, res, next) => {
  try {
    const item = await repo.update(req.params.id, req.body, req.user.id);
    if (!item) throw new NotFoundError('Item de catálogo');
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

export const deleteItem = async (req, res, next) => {
  try {
    await repo.delete(req.params.id);
    res.json({ success: true, message: 'Item eliminado del catálogo' });
  } catch (err) { next(err); }
};

export const uploadImagen = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      console.error('Error: No se recibió archivo en req.file (Middleware)');
      return res.status(400).json({ 
        success: false, 
        message: 'No se recibió el archivo en el campo "documento". Verifique el FormData del frontend.',
        debug: {
          headers: req.headers['content-type'],
          body: req.body
        }
      });
    }

    // 1. Preparar la ruta de subida
    const uploadPath = buildUploadPath('CATALOGO', id, 'imagenes');

    // 2. Guardar físicamente
    const fileMeta = await guardarArchivo(req.file.buffer, uploadPath, req.file.originalname);

    // 3. Actualizar base de datos
    const item = await repo.update(id, { 
      imagen_url: fileMeta.rutaRelativa,
      imagen_thumb_url: fileMeta.rutaRelativa 
    }, req.user.id);

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error en uploadImagen:', error);
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
