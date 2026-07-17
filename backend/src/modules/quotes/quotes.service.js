import { QuotesRepository } from './quotes.repository.js';
import { InventoryRepository } from '../inventory/inventory.repository.js';
import { query, withTransaction } from '../../config/database.js';
import { ValidationError } from '../../utils/errors.js';

const repo = new QuotesRepository();
const inventoryRepo = new InventoryRepository();

export const quotesService = {
  async createQuote(data, userId) {
    // Sanitizar campos FK de cabecera: convertir cadenas vacías a null
    const uuidOrNull = (v) => (v && typeof v === 'string' && v.trim() !== '') ? v.trim() : null;
    data.company_id = uuidOrNull(data.company_id);
    data.opportunity_id = uuidOrNull(data.opportunity_id);
    data.contact_id = uuidOrNull(data.contact_id);

    const { items = [] } = data;

    // Sanitizar campos FK dentro de cada ítem
    for (const it of items) {
      it.inventario_id = uuidOrNull(it.inventario_id);
      it.proveedor_id = uuidOrNull(it.proveedor_id);
      it.supplier_quote_id = uuidOrNull(it.supplier_quote_id);
      it.autorizado_por = uuidOrNull(it.autorizado_por);
    }

    // 1. Validaciones de negocio antes de crear
    for (const it of items) {
      const isInventario = it.origen === 'inventario' || !it.origen;
      
      // A. Validación de stock disponible para ítems de inventario propio
      if (isInventario && it.inventario_id) {
        const availability = await inventoryRepo.getAvailability(it.inventario_id);
        const stockDisponible = availability ? parseInt(availability.stock_disponible, 10) : 0;
        if (parseFloat(it.quantity) > stockDisponible) {
          throw new ValidationError(
            `El ítem "${it.description || 'Sin descripción'}" no cuenta con suficiente stock disponible (${stockDisponible} unidades disponibles) y debe ser cotizado a través de un proveedor.`
          );
        }
      }

      // B. Validación de markup mínimo (23%)
      const costo = parseFloat(it.costo_base || 0);
      const precioUnitario = parseFloat(it.unit_price || 0);
      const descuento = parseFloat(it.discount || 0);
      const precioNeto = precioUnitario * (1 - descuento / 100);
      const precioSugeridoConMarkup = Math.round(costo * 1.23);

      if (precioNeto < precioSugeridoConMarkup) {
        if (!it.autorizado_por || !it.justificacion_descuento || !it.justificacion_descuento.trim()) {
          throw new ValidationError(
            `El ítem "${it.description || 'Sin descripción'}" tiene un margen neto por debajo del 23% mínimo permitido. Requiere obligatoriamente un usuario de autorización y justificación del descuento.`
          );
        }
      }
    }

    // 2. Crear la cotización en la base de datos
    const quote = await repo.create(data, userId);

    // 3. Crear reservas soft en inventario_reservas para ítems de inventario
    if (quote && Array.isArray(quote.items)) {
      for (const item of quote.items) {
        const isInventario = item.origen === 'inventario' || !item.origen;
        if (isInventario && item.inventario_id) {
          await query(
            `INSERT INTO inventario_reservas (inventario_id, quote_id, quote_item_id, cantidad_reservada, estado, creado_en, expira_en)
             VALUES ($1, $2, $3, $4, 'activa', NOW(), NOW() + INTERVAL '15 days')`,
            [item.inventario_id, quote.id, item.id, parseInt(item.quantity, 10)]
          );
        }
      }
    }

    return repo.findById(quote.id);
  },

  async updateQuote(id, data, userId) {
    // Sanitizar campos FK de cabecera
    const uuidOrNull = (v) => (v && typeof v === 'string' && v.trim() !== '') ? v.trim() : null;
    data.company_id = uuidOrNull(data.company_id);
    data.opportunity_id = uuidOrNull(data.opportunity_id);
    data.contact_id = uuidOrNull(data.contact_id);

    const { items } = data;

    // Sanitizar campos FK dentro de cada ítem
    if (Array.isArray(items)) {
      for (const it of items) {
        it.inventario_id = uuidOrNull(it.inventario_id);
        it.proveedor_id = uuidOrNull(it.proveedor_id);
        it.supplier_quote_id = uuidOrNull(it.supplier_quote_id);
        it.autorizado_por = uuidOrNull(it.autorizado_por);
      }
    }

    if (Array.isArray(items)) {
      // 1. Validaciones de negocio antes de actualizar
      for (const it of items) {
        const isInventario = it.origen === 'inventario' || !it.origen;

        // A. Validación de stock disponible
        if (isInventario && it.inventario_id) {
          const availability = await inventoryRepo.getAvailability(it.inventario_id);
          const stockDisponibleGlobal = availability ? parseInt(availability.stock_disponible, 10) : 0;
          
          // Consultar si hay una reserva activa actual para este item en esta cotización
          const currentRes = await query(
            `SELECT cantidad_reservada FROM inventario_reservas 
             WHERE quote_id = $1 AND inventario_id = $2 AND estado = 'activa'`,
            [id, it.inventario_id]
          );
          const reservadoActualmente = currentRes.rows[0] ? parseInt(currentRes.rows[0].cantidad_reservada, 10) : 0;
          const stockDisponibleTotal = stockDisponibleGlobal + reservadoActualmente;

          if (parseFloat(it.quantity) > stockDisponibleTotal) {
            throw new ValidationError(
              `El ítem "${it.description || 'Sin descripción'}" no cuenta con suficiente stock disponible (${stockDisponibleTotal} unidades disponibles sumando reserva actual) y debe ser cotizado a través de un proveedor.`
            );
          }
        }

        // B. Validación de markup mínimo (23%)
        const costo = parseFloat(it.costo_base || 0);
        const precioUnitario = parseFloat(it.unit_price || 0);
        const descuento = parseFloat(it.discount || 0);
        const precioNeto = precioUnitario * (1 - descuento / 100);
        const precioSugeridoConMarkup = Math.round(costo * 1.23);

        if (precioNeto < precioSugeridoConMarkup) {
          if (!it.autorizado_por || !it.justificacion_descuento || !it.justificacion_descuento.trim()) {
            throw new ValidationError(
              `El ítem "${it.description || 'Sin descripción'}" tiene un margen neto por debajo del 23% mínimo permitido. Requiere obligatoriamente un usuario de autorización y justificación del descuento.`
            );
          }
        }
      }

      // 2. Si las validaciones son exitosas, liberar las reservas anteriores
      await query(
        `DELETE FROM inventario_reservas WHERE quote_id = $1`,
        [id]
      );
    }

    // 3. Actualizar la cotización en la DB
    const quote = await repo.update(id, data);

    // 4. Si se actualizaron ítems, registrar las nuevas reservas soft
    if (Array.isArray(items) && quote && Array.isArray(quote.items)) {
      for (const item of quote.items) {
        const isInventario = item.origen === 'inventario' || !item.origen;
        if (isInventario && item.inventario_id) {
          await query(
            `INSERT INTO inventario_reservas (inventario_id, quote_id, quote_item_id, cantidad_reservada, estado, creado_en, expira_en)
             VALUES ($1, $2, $3, $4, 'activa', NOW(), NOW() + INTERVAL '15 days')`,
            [item.inventario_id, quote.id, item.id, parseInt(item.quantity, 10)]
          );
        }
      }
    }

    return repo.findById(id);
  },

  async changeStatus(id, status, userId, existingClient = null) {
    const quote = await repo.findById(id);
    if (!quote) throw new ValidationError('Cotización no encontrada');

    if (status === 'accepted') {
      if (quote.status === 'accepted') {
        throw new ValidationError('La cotización ya ha sido aceptada previamente');
      }

      // Proceso atómico de aceptación y deducción de stock
      const logic = async (client) => {
        // A. Actualizar estado de la cotización
        await client.query(
          `UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2`,
          [status, id]
        );

        // B. Deducir stock físico y registrar movimientos
        for (const item of quote.items) {
          const isInventario = item.origen === 'inventario' || !item.origen;
          if (isInventario && item.inventario_id) {
            const qty = parseFloat(item.quantity) || 0;

            // 1. Obtener estado actual del inventario (con bloqueo para concurrencia)
            const invRes = await client.query(
              `SELECT stock_actual, costo_promedio_ponderado FROM inventario WHERE id = $1 FOR UPDATE`,
              [item.inventario_id]
            );

            if (invRes.rows.length > 0) {
              const inv = invRes.rows[0];
              const stockAntes = Math.round(parseFloat(inv.stock_actual || 0));
              const stockDespues = Math.round(stockAntes - qty);

              // 2. Deducir stock físico
              await client.query(
                `UPDATE inventario SET stock_actual = $1, updated_at = NOW() WHERE id = $2`,
                [stockDespues, item.inventario_id]
              );

              // 3. Registrar movimiento de inventario completo
              const precioVenta = parseFloat(item.unit_price || 0);
              const subtotalVenta = precioVenta * qty;

              await client.query(
                `INSERT INTO movimientos_inventario (
                  inventario_id, tipo_movimiento, cantidad, numero_documento, notas, registrado_por,
                  stock_antes, stock_despues, costo_promedio_antes, costo_promedio_despues,
                  precio_unitario, subtotal
                ) VALUES ($1, 'SALIDA_OT', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                  item.inventario_id,
                  Math.round(qty),
                  quote.quote_number,
                  `Deducción por cotización cliente aceptada: ${quote.quote_number}`,
                  userId,
                  stockAntes,
                  stockDespues,
                  precioVenta, // Asignar el precio unitario de la cotización
                  precioVenta, // Como costo final
                  precioVenta,
                  subtotalVenta
                ]
              );
            }
          }
        }

        // C. Liberar reservas soft
        await client.query(
          `UPDATE inventario_reservas SET estado = 'liberada' WHERE quote_id = $1`,
          [id]
        );

        // D. Cambiar estado de cotizaciones de proveedor vinculadas a ACEPTADO
        const supplierQuoteIds = [
          ...new Set(
            quote.items
              .map(it => it.supplier_quote_id)
              .filter(sid => sid != null)
          )
        ];
        if (supplierQuoteIds.length > 0) {
          const placeholders = supplierQuoteIds.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `UPDATE supplier_quotes SET estado_comercial = 'ACEPTADO', updated_at = NOW() WHERE id IN (${placeholders})`,
            supplierQuoteIds
          );
        }
      };

      if (existingClient) {
        await logic(existingClient);
      } else {
        await withTransaction(logic);
      }

      return repo.findById(id);
    } else {
      // Para estados como rechazado, expirado, etc., se liberan las reservas soft
      const logic = async (client) => {
        await client.query(
          `UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2`,
          [status, id]
        );
        await client.query(
          `UPDATE inventario_reservas SET estado = 'liberada' WHERE quote_id = $1`,
          [id]
        );

        // E. Revertir estado de cotizaciones de proveedor vinculadas si ya no hay ninguna cotización cliente aceptada que las use
        const supplierQuoteIds = [
          ...new Set(
            quote.items
              .map(it => it.supplier_quote_id)
              .filter(sid => sid != null)
          )
        ];
        for (const sqId of supplierQuoteIds) {
          // Verificar si existe otra cotización cliente aceptada que use esta misma cotización de proveedor
          const otherAccepted = await client.query(
            `SELECT 1 FROM quotes q
             JOIN quote_items qi ON qi.quote_id = q.id
             WHERE qi.supplier_quote_id = $1
               AND q.status = 'accepted'
               AND q.id != $2
             LIMIT 1`,
            [sqId, id]
          );
          if (otherAccepted.rows.length === 0) {
            // Ninguna otra cotización cliente aceptada la usa: devolver a EN_ESPERA
            await client.query(
              `UPDATE supplier_quotes SET estado_comercial = 'EN_ESPERA', updated_at = NOW() WHERE id = $1`,
              [sqId]
            );
          }
        }
      };

      if (existingClient) {
        await logic(existingClient);
      } else {
        await withTransaction(logic);
      }

      return repo.findById(id);
    }
  }
};
