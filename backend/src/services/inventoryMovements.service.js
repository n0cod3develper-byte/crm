
import { db, query } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Registra un movimiento de inventario y actualiza el stock
 * y costo promedio del producto de forma atómica.
 * 
 * REGLA DE ORO: Este es el ÚNICO punto del sistema donde se
 * modifica stock_actual y costo_promedio_ponderado.
 */
export async function registrarMovimiento(datos, client = null) {
  const debeGestionarTransaccion = !client;
  const conn = client || await db.connect();

  try {
    if (debeGestionarTransaccion) await conn.query('BEGIN');

    // ── PASO 1: Bloquear la fila del producto ──────────────────────
    const productoResult = await conn.query(`
      SELECT 
        id, name as nombre, tipo,
        stock_actual,
        costo_promedio_ponderado,
        precio_piso,
        precio_venta_sugerido,
        categoria_id
      FROM inventario
      WHERE id = $1
      FOR UPDATE
    `, [datos.inventario_id]);

    if (productoResult.rows.length === 0) {
      throw new Error(`Producto no encontrado: ${datos.inventario_id}`);
    }

    const producto = productoResult.rows[0];

    // ── PASO 2: Validaciones según tipo de movimiento ──────────────
    const esEntrada = datos.tipo_movimiento.startsWith('ENTRADA') || 
                      datos.tipo_movimiento === 'TRASLADO_ENTRADA';
    const esSalida  = datos.tipo_movimiento.startsWith('SALIDA') || 
                      datos.tipo_movimiento === 'TRASLADO_SALIDA';

    if (datos.cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a cero');
    }

    if (esSalida) {
      if (parseFloat(producto.stock_actual) < datos.cantidad) {
        throw new Error(
          `Stock insuficiente para ${producto.nombre}. ` +
          `Disponible: ${producto.stock_actual} — ` +
          `Solicitado: ${datos.cantidad}`
        );
      }
    }

    if (esEntrada && 
        datos.tipo_movimiento !== 'ENTRADA_AJUSTE' && 
        (!datos.precio_unitario || datos.precio_unitario <= 0)) {
      throw new Error(
        'El precio unitario es obligatorio para entradas de compra'
      );
    }

    // ── PASO 3: Calcular nuevo stock ───────────────────────────────
    const stockAntes   = parseFloat(producto.stock_actual) || 0;
    const cantidad     = parseFloat(datos.cantidad);
    const stockDespues = esEntrada 
      ? stockAntes + cantidad 
      : stockAntes - cantidad;

    // ── PASO 4: Recalcular costo promedio ponderado ────────────────
    const costoAntes = parseFloat(producto.costo_promedio_ponderado) || 0;
    let costoNuevo   = costoAntes;

    if (esEntrada && datos.precio_unitario > 0 && 
        datos.tipo_movimiento !== 'ENTRADA_AJUSTE') {
      if (stockAntes <= 0) {
        costoNuevo = parseFloat(datos.precio_unitario);
      } else {
        costoNuevo = (
          (stockAntes * costoAntes) + 
          (cantidad   * parseFloat(datos.precio_unitario))
        ) / (stockAntes + cantidad);
      }
      costoNuevo = Math.round(costoNuevo * 100) / 100;
    }

    // ── PASO 5: Recalcular precio_piso y precio_venta_sugerido ─────
    let precioNuevoPiso     = parseFloat(producto.precio_piso) || 0;
    let precioNuevoSugerido = parseFloat(producto.precio_venta_sugerido) || 0;

    if (costoNuevo !== costoAntes && costoNuevo > 0) {
      const margenes = await obtenerMargenes(
        conn,
        producto.margen_minimo_pct,
        producto.margen_objetivo_pct,
        producto.categoria_id
      );

      precioNuevoPiso = Math.round(
        costoNuevo * (1 + margenes.minimo / 100) * 100
      ) / 100;

      precioNuevoSugerido = Math.round(
        costoNuevo * (1 + margenes.objetivo / 100) * 100
      ) / 100;

      if (precioNuevoPiso > parseFloat(producto.precio_venta_sugerido)) {
        await registrarAlertaMargen(conn, producto, precioNuevoPiso);
      }
    }

    // ── PASO 6: Calcular subtotales del movimiento ─────────────────
    const precioUnitario = parseFloat(datos.precio_unitario) || 0;
    const subtotal       = Math.round(precioUnitario * cantidad * 100) / 100;
    const ivaPct         = parseFloat(datos.iva_pct) || 0;
    const ivaValor       = Math.round(subtotal * ivaPct / 100 * 100) / 100;
    const totalConIva    = Math.round((subtotal + ivaValor) * 100) / 100;

    // ── PASO 7: Actualizar el producto en inventario ───────────────
    await conn.query(`
      UPDATE inventario SET
        stock_actual                = $1,
        costo_promedio_ponderado    = $2,
        precio_piso                 = $3,
        precio_venta_sugerido       = $4,
        fecha_ultimo_costo          = NOW(),
        updated_at                  = NOW()
      WHERE id = $5
    `, [
      stockDespues,
      costoNuevo,
      precioNuevoPiso,
      precioNuevoSugerido,
      datos.inventario_id
    ]);

    // ── PASO 8: Registrar el movimiento con snapshot completo ──────
    const proveedorNombre = datos.proveedor_id 
      ? await obtenerNombreProveedor(conn, datos.proveedor_id)
      : datos.proveedor_nombre_libre || null;

    const movResult = await conn.query(`
      INSERT INTO movimientos_inventario (
        inventario_id,
        tipo_movimiento,
        tipo_documento,
        numero_documento,
        fecha_documento,
        cantidad,
        precio_unitario,
        subtotal,
        iva_pct,
        iva_valor,
        total_con_iva,
        stock_antes,
        stock_despues,
        costo_promedio_antes,
        costo_promedio_despues,
        proveedor_id,
        proveedor_nombre,
        oc_id,
        ot_id,
        ubicacion_id,
        notas,
        registrado_por
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      RETURNING *
    `, [
      datos.inventario_id,
      datos.tipo_movimiento,
      datos.tipo_documento    || 'FACTURA',
      datos.numero_documento  || null,
      datos.fecha_documento   || new Date(),
      cantidad,
      precioUnitario          || null,
      subtotal                || null,
      ivaPct,
      ivaValor,
      totalConIva             || null,
      stockAntes,
      stockDespues,
      costoAntes,
      costoNuevo,
      datos.proveedor_id      || null,
      proveedorNombre,
      datos.oc_id             || null,
      datos.ot_id             || null,
      datos.ubicacion_id      || null,
      datos.notas             || null,
      datos.registrado_por,
    ]);

    if (debeGestionarTransaccion) await conn.query('COMMIT');

    return {
      movimiento: movResult.rows[0],
      producto: {
        id:                       datos.inventario_id,
        stock_anterior:           stockAntes,
        stock_nuevo:              stockDespues,
        costo_promedio_anterior:  costoAntes,
        costo_promedio_nuevo:     costoNuevo,
        precio_piso_nuevo:        precioNuevoPiso,
        precio_sugerido_nuevo:    precioNuevoSugerido,
        costo_cambio:             costoNuevo !== costoAntes,
      }
    };

  } catch (err) {
    if (debeGestionarTransaccion) await conn.query('ROLLBACK');
    throw err;
  } finally {
    if (debeGestionarTransaccion) conn.release();
  }
}

async function obtenerMargenes(conn, margenMinProd, margenObjProd, catId) {
  if (margenMinProd && margenObjProd) {
    return { minimo: margenMinProd, objetivo: margenObjProd };
  }
  if (catId) {
    const cat = await conn.query(
      'SELECT margen_minimo_pct, margen_objetivo_pct FROM catalogo_categorias WHERE id=$1',
      [catId]
    );
    if (cat.rows.length > 0) {
      return { 
        minimo:   parseFloat(cat.rows[0].margen_minimo_pct) || 20, 
        objetivo: parseFloat(cat.rows[0].margen_objetivo_pct) || 35
      };
    }
  }
  return { minimo: 20, objetivo: 35 };
}

async function obtenerNombreProveedor(conn, proveedorId) {
  const res = await conn.query(
    'SELECT razon_social FROM proveedores WHERE id = $1',
    [proveedorId]
  );
  return res.rows[0]?.razon_social || null;
}

async function registrarAlertaMargen(conn, producto, precioNuevoPiso) {
  // Log instead of notification if table doesn't exist, or try to insert
  try {
    await conn.query(`
      INSERT INTO tasks (title, description, status, priority, type)
      VALUES ($1, $2, 'pending', 'high', 'task')
    `, [
      'Alerta de Margen: ' + producto.nombre,
      `El costo subió. Nuevo precio piso ($${precioNuevoPiso.toLocaleString()}) supera precio sugerido.`
    ]);
  } catch (e) {
    logger.warn('No se pudo registrar alerta de margen en tasks', { error: e.message });
  }
}
