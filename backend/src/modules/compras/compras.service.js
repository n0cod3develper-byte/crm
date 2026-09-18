import { db } from '../../config/database.js';
import { comprasRepository } from './compras.repository.js';
import { registrarMovimiento } from '../../services/inventoryMovements.service.js';
import { logger } from '../../utils/logger.js';

export class ComprasService {
  /**
   * Registra una compra con uno o varios ítems bajo el mismo número de factura.
   * Ejecuta todo en una transacción atómica:
   * 1. Verifica proveedor.
   * 2. Itera sobre cada ítem:
   *    - Inserta en compras_registro
   *    - Registra el movimiento de inventario (actualiza stock_actual y costo_promedio_ponderado)
   *    - Vincula movimiento_id a la compra
   * 3. Si algún ítem falla, hace ROLLBACK de todo.
   */
  async registrarCompra(data, userId) {
    // Soportar tanto payload con `items: [...]` como payload de 1 solo ítem
    const rawItems = Array.isArray(data.items) && data.items.length > 0
      ? data.items
      : [{
          producto_id: data.producto_id,
          cantidad: data.cantidad,
          precio_unitario: data.precio_unitario,
          iva_pct: data.iva_pct,
          observaciones: data.observaciones
        }];

    const client = await db.connect();

    try {
      // 1. Validaciones de Cabecera
      const numeroFactura = (data.numero_factura || '').trim();
      if (!numeroFactura) {
        throw new Error('El número de factura es obligatorio');
      }

      if (!data.fecha_compra) {
        throw new Error('La fecha de compra es obligatoria');
      }

      if (!data.proveedor_id) {
        throw new Error('El proveedor es obligatorio');
      }

      if (rawItems.length === 0) {
        throw new Error('Debe agregar al menos un producto a la factura');
      }

      // Validar cada ítem antes de iniciar
      const itemsValidados = rawItems.map((item, idx) => {
        if (!item.producto_id) {
          throw new Error(`Ítem #${idx + 1}: El producto es obligatorio`);
        }
        const cantidad = parseFloat(item.cantidad);
        if (isNaN(cantidad) || cantidad <= 0) {
          throw new Error(`Ítem #${idx + 1}: La cantidad debe ser un número mayor a cero`);
        }
        const precioUnitario = parseFloat(item.precio_unitario);
        if (isNaN(precioUnitario) || precioUnitario < 0) {
          throw new Error(`Ítem #${idx + 1}: El precio unitario debe ser mayor o igual a cero`);
        }
        const ivaPct = item.iva_pct !== undefined && item.iva_pct !== '' ? parseFloat(item.iva_pct) : 0;

        return {
          producto_id: item.producto_id,
          cantidad,
          precio_unitario: precioUnitario,
          iva_pct: ivaPct,
          observaciones: item.observaciones || data.observaciones || null
        };
      });

      await client.query('BEGIN');

      // 2. Verificar existencia del proveedor
      const provRes = await client.query(
        'SELECT id, razon_social, nombre_comercial FROM proveedores WHERE id = $1',
        [data.proveedor_id]
      );
      if (provRes.rows.length === 0) {
        throw new Error(`Proveedor no encontrado: ${data.proveedor_id}`);
      }
      const proveedor = provRes.rows[0];
      const proveedorNombre = proveedor.nombre_comercial || proveedor.razon_social;

      const resultados = [];

      // 3. Procesar cada ítem
      for (let i = 0; i < itemsValidados.length; i++) {
        const it = itemsValidados[i];

        // Verificar y bloquear fila del producto en inventario
        const prodRes = await client.query(
          'SELECT id, name, nombre_comercial, tipo, stock_actual FROM inventario WHERE id = $1 FOR UPDATE',
          [it.producto_id]
        );
        if (prodRes.rows.length === 0) {
          throw new Error(`Producto no encontrado en inventario (ítem #${i + 1}): ${it.producto_id}`);
        }
        const prodInfo = prodRes.rows[0];

        // Guardar registro en compras_registro
        const compra = await comprasRepository.insertarCompra({
          numero_factura: numeroFactura,
          fecha_compra: data.fecha_compra,
          proveedor_id: data.proveedor_id,
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          iva_pct: it.iva_pct,
          observaciones: it.observaciones,
          registrado_por: userId
        }, client);

        // Registrar movimiento de inventario (actualiza stock_actual y costo promedio en inventario)
        const notasMovimiento = it.observaciones 
          ? `Factura ${numeroFactura}: ${it.observaciones}`
          : `Compra registrada con Factura ${numeroFactura}`;

        const movResult = await registrarMovimiento({
          inventario_id: it.producto_id,
          tipo_movimiento: 'ENTRADA_COMPRA',
          tipo_documento: 'FACTURA',
          numero_documento: numeroFactura,
          fecha_documento: data.fecha_compra,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          iva_pct: it.iva_pct,
          proveedor_id: data.proveedor_id,
          proveedor_nombre_libre: proveedorNombre,
          notas: notasMovimiento,
          registrado_por: userId
        }, client);

        // Vincular movimiento_id a la compra
        if (movResult?.movimiento?.id) {
          await comprasRepository.vincularMovimiento(compra.id, movResult.movimiento.id, client);
          compra.movimiento_id = movResult.movimiento.id;
        }

        resultados.push({
          compra,
          producto_nombre: prodInfo.name || prodInfo.nombre_comercial,
          movimiento: movResult?.movimiento,
          stock_anterior: movResult?.producto?.stock_anterior,
          stock_nuevo: movResult?.producto?.stock_nuevo,
          costo_promedio_nuevo: movResult?.producto?.costo_promedio_nuevo
        });
      }

      await client.query('COMMIT');

      logger.info('Factura de compra registrada exitosamente', {
        factura: numeroFactura,
        proveedorId: data.proveedor_id,
        itemsCount: resultados.length
      });

      const primerItem = resultados[0];
      return {
        numero_factura: numeroFactura,
        fecha_compra: data.fecha_compra,
        proveedor: proveedorNombre,
        total_items: resultados.length,
        items: resultados,
        // Compatibilidad hacia atrás si se consulta el primer ítem
        compra: primerItem?.compra,
        movimiento: primerItem?.movimiento,
        stock_anterior: primerItem?.stock_anterior,
        stock_nuevo: primerItem?.stock_nuevo,
        costo_promedio_nuevo: primerItem?.costo_promedio_nuevo
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error al registrar compra:', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      client.release();
    }
  }

  async buscarProductos(q, limit) {
    return await comprasRepository.buscarProductos(q, limit);
  }

  async getProductoInfoCompra(productoId) {
    return await comprasRepository.getProductoInfoCompra(productoId);
  }

  async getHistorialCompras(filters) {
    return await comprasRepository.getHistorialCompras(filters);
  }

  async getHistorialPreciosPorProducto(productoId) {
    return await comprasRepository.getHistorialPreciosPorProducto(productoId);
  }

  async getOrdenesCompraLegacy() {
    return await comprasRepository.getOrdenesCompraLegacy();
  }

  async getOrdenCompraLegacyById(id) {
    return await comprasRepository.getOrdenCompraLegacyById(id);
  }
}

export const comprasService = new ComprasService();
