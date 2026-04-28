import { MovementsRepository } from './movements.repository.js';
import { InventoryRepository } from './inventory.repository.js';

const repo = new MovementsRepository();
const inventoryRepo = new InventoryRepository();

export const getMovements = async (req, res) => {
  try {
    const { itemId, type, limit } = req.query;
    const data = await repo.findAll({ itemId, type, limit: limit ? parseInt(limit) : 50 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMovement = async (req, res) => {
  try {
    const userId = req.auth?.userId || req.user?.id;
    const movement = await repo.create(req.body, userId);
    res.status(201).json({ success: true, data: movement });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Registrar entrada directa de inventario (Compra)
 * POST /api/inventory/movements/entrada
 */
export const registrarEntrada = async (req, res) => {
  try {
    console.log('[MovementsController] Registro de entrada req.body:', req.body);
    const {
      inventario_id,
      cantidad,
      precio_unitario,
      iva_pct,
      proveedor_id,
      proveedor_nombre_libre,
      numero_documento,
      tipo_documento,
      fecha_documento,
      ubicacion_id,
      notas
    } = req.body;

    // Validaciones
    if (!inventario_id) {
      console.warn('[MovementsController] Falta inventario_id');
      return res.status(400).json({ error: 'El producto es obligatorio' });
    }
    if (!cantidad || parseFloat(cantidad) <= 0) {
      console.warn('[MovementsController] Cantidad inválida:', cantidad);
      return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
    }
    if (!precio_unitario || parseFloat(precio_unitario) <= 0) {
      console.warn('[MovementsController] Precio unitario inválido:', precio_unitario);
      return res.status(400).json({ error: 'El precio unitario es obligatorio para registrar una compra' });
    }

    const producto = await inventoryRepo.findById(inventario_id);
    if (!producto) {
      console.warn('[MovementsController] Producto no encontrado:', inventario_id);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (producto.tipo === 'SERVICIO') {
      return res.status(400).json({ error: 'No se puede registrar stock para un Servicio' });
    }

    const userId = req.auth?.userId || req.user?.id || 'system';

    const resultado = await repo.create({
      inventario_id,
      tipo_movimiento: 'ENTRADA_COMPRA',
      tipo_documento: tipo_documento || 'FACTURA',
      numero_documento,
      fecha_documento,
      cantidad,
      precio_unitario,
      iva_pct,
      proveedor_id,
      proveedor_nombre_libre,
      ubicacion_id,
      notas
    }, userId);

    res.status(201).json({
      success: true,
      mensaje: 'Entrada registrada correctamente',
      data: resultado
    });

  } catch (err) {
    console.error('[MovementsController] Error en registrarEntrada:', err);
    res.status(400).json({ 
      success: false, 
      error: err.message,
      detail: err.detail || null 
    });
  }
};

export const getMovementStats = async (req, res) => {
  try {
    const stats = await repo.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
