import { proveedoresRepository } from './proveedores.repository.js';
import { createProveedorSchema, updateProveedorSchema } from './proveedores.schema.js';

export const getProveedores = async (req, res) => {
  try {
    const { tipo, estado, condicion_pago, search, limit, offset } = req.query;
    const result = await proveedoresRepository.findAll({
      tipo,
      estado,
      condicion_pago,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProveedorById = async (req, res) => {
  try {
    const proveedor = await proveedoresRepository.findById(req.params.id);
    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(proveedor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProveedor = async (req, res) => {
  try {
    const data = createProveedorSchema.parse(req.body);
    
    // Validación NIT único
    const exists = await proveedoresRepository.checkDocumentoExists(data.numero_documento);
    if (exists) {
      return res.status(400).json({ error: 'El número de documento ya está registrado' });
    }

    const proveedor = await proveedoresRepository.create(data, req.user.id);
    res.status(201).json(proveedor);
  } catch (error) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

export const updateProveedor = async (req, res) => {
  try {
    const data = updateProveedorSchema.parse(req.body);
    
    if (data.numero_documento) {
      const exists = await proveedoresRepository.checkDocumentoExists(data.numero_documento, req.params.id);
      if (exists) {
        return res.status(400).json({ error: 'El número de documento ya está registrado por otro proveedor' });
      }
    }

    const proveedor = await proveedoresRepository.update(req.params.id, data);
    res.json(proveedor);
  } catch (error) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

export const deleteProveedor = async (req, res) => {
  try {
    await proveedoresRepository.delete(req.params.id);
    res.json({ success: true, message: 'Proveedor inactivado y eliminado lógicamente' });
  } catch (error) {
    if (error.message.includes('activas o pendientes')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const calificarProveedor = async (req, res) => {
  try {
    const { calificacion } = req.body;
    if (calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
    }
    const proveedor = await proveedoresRepository.rate(req.params.id, calificacion);
    res.json(proveedor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
