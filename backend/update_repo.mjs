import fs from 'fs';
const path = 'c:/Users/Sistemas/CRM/crm/backend/src/modules/facturacion/facturacion.repository.js';
let content = fs.readFileSync(path, 'utf8');

const createOld = `  async createPrefacturaFromRemisiones(data, createdBy) {
    const { empresa_id, remision_ids, condicion_pago, fecha_vencimiento, notas, numero_factura, fecha_factura } = data;

    return await withTransaction(async (client) => {
      // 1. Validar remisiones
      const remSql = \`
        SELECT r.id, r.numero_remision, r.company_id, r.estado, r.factura_id,
               r.total_bruto AS subtotal, r.iva_valor, r.total_neto AS total
        FROM remisiones r
        WHERE r.id = ANY($1)
      \`;
      const remRes = await client.query(remSql, [remision_ids]);
      const rems = remRes.rows;

      if (rems.length !== remision_ids.length) {
        throw new BadRequestError('Una o más remisiones no existen');
      }

      for (const rem of rems) {
        if (rem.company_id !== empresa_id) {
          throw new BadRequestError(\`La remisión \${rem.numero_remision} no pertenece a la empresa seleccionada\`);
        }
        if (rem.estado !== 'LIQUIDADA' || rem.factura_id !== null) {
          throw new BadRequestError(\`La remisión \${rem.numero_remision} no está disponible para facturar\`);
        }
      }

      // 2. Generar consecutivo interno
      const consRes = await client.query(\`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      \`);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = \`FAC-\${String(nro).padStart(5, '0')}\`;

      // 3. Calcular totales
      const subtotal = rems.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);
      const iva_valor = rems.reduce((sum, r) => sum + parseFloat(r.iva_valor), 0);
      const total = rems.reduce((sum, r) => sum + parseFloat(r.total), 0);

      // 4. Insertar factura
      const estado = numero_factura ? 'FACTURADA' : 'PREFACTURA';
      const fechaFacturaVal = fecha_factura ? new Date(fecha_factura) : (numero_factura ? new Date() : null);
      const insFactSql = \`
        INSERT INTO facturas (
          consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado,
          subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas,
          creada_por, facturada_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      \`;
      const factRes = await client.query(insFactSql, [
        consecutivo_interno,
        numero_factura || null,
        fechaFacturaVal,
        empresa_id,
        estado,
        subtotal, iva_valor, total,
        condicion_pago || null, fecha_vencimiento || null, notas || null,
        createdBy,
        numero_factura ? createdBy : null
      ]);
      const factura = factRes.rows[0];

      // 5. Relacionar remisiones
      for (const rem of rems) {
        await client.query(\`
          INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
          VALUES ($1, $2, $3, $4, $5, $6)
        \`, [factura.id, rem.id, rem.numero_remision, rem.subtotal, rem.iva_valor, rem.total]);

        const remEstado = numero_factura ? 'FACTURADA' : 'LIQUIDADA';
        const fechaFacturada = numero_factura ? 'NOW()' : 'NULL';

        await client.query(\`
          UPDATE remisiones SET
            factura_id = $1,
            estado = $2,
            fecha_facturada = \${fechaFacturada}
          WHERE id = $3
        \`, [factura.id, remEstado, rem.id]);
      }

      return factura;
    });
  }`;

const createNew = `  async createPrefacturaFromRemisiones(data, createdBy) {
    const { empresa_id, remisiones, condicion_pago, fecha_vencimiento, notas, numero_factura, fecha_factura } = data;
    // remisiones debe ser un array de objetos: { id, subtotal, iva_valor, total }

    return await withTransaction(async (client) => {
      // 1. Validar remisiones
      const remisionIds = remisiones.map(r => r.id);
      const remSql = \`
        SELECT r.id, r.numero_remision, r.company_id, r.estado,
               r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS saldo_pendiente
        FROM remisiones r
        WHERE r.id = ANY($1)
      \`;
      const remRes = await client.query(remSql, [remisionIds]);
      const dbRems = remRes.rows;

      if (dbRems.length !== remisionIds.length) {
        throw new BadRequestError('Una o más remisiones no existen');
      }

      for (const reqRem of remisiones) {
        const dbRem = dbRems.find(r => r.id === reqRem.id);
        if (dbRem.company_id !== empresa_id) {
          throw new BadRequestError(\`La remisión \${dbRem.numero_remision} no pertenece a la empresa seleccionada\`);
        }
        if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbRem.estado)) {
          throw new BadRequestError(\`La remisión \${dbRem.numero_remision} no está disponible para facturar\`);
        }
        // Validar que no se facture más del saldo
        if (parseFloat(reqRem.total) > parseFloat(dbRem.saldo_pendiente) + 0.05) {
          throw new BadRequestError(\`El valor a facturar de la remisión \${dbRem.numero_remision} supera su saldo pendiente\`);
        }
      }

      // 2. Generar consecutivo interno
      const consRes = await client.query(\`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      \`);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = \`FAC-\${String(nro).padStart(5, '0')}\`;

      // 3. Calcular totales
      const subtotal = remisiones.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);
      const iva_valor = remisiones.reduce((sum, r) => sum + parseFloat(r.iva_valor), 0);
      const total = remisiones.reduce((sum, r) => sum + parseFloat(r.total), 0);

      // 4. Insertar factura
      const estado = numero_factura ? 'FACTURADA' : 'PREFACTURA';
      const fechaFacturaVal = fecha_factura ? new Date(fecha_factura) : (numero_factura ? new Date() : null);
      const insFactSql = \`
        INSERT INTO facturas (
          consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado,
          subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas,
          creada_por, facturada_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      \`;
      const factRes = await client.query(insFactSql, [
        consecutivo_interno,
        numero_factura || null,
        fechaFacturaVal,
        empresa_id,
        estado,
        subtotal, iva_valor, total,
        condicion_pago || null, fecha_vencimiento || null, notas || null,
        createdBy,
        numero_factura ? createdBy : null
      ]);
      const factura = factRes.rows[0];

      // 5. Relacionar remisiones
      for (const reqRem of remisiones) {
        const dbRem = dbRems.find(r => r.id === reqRem.id);
        
        await client.query(\`
          INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
          VALUES ($1, $2, $3, $4, $5, $6)
        \`, [factura.id, dbRem.id, dbRem.numero_remision, reqRem.subtotal, reqRem.iva_valor, reqRem.total]);

        // Verificar si la remisión se saldó por completo
        const nuevoSaldo = parseFloat(dbRem.saldo_pendiente) - parseFloat(reqRem.total);
        const remEstado = nuevoSaldo <= 0.05 ? (numero_factura ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA') : 'PARCIALMENTE_FACTURADA';

        await client.query(\`
          UPDATE remisiones SET
            estado = $1
          WHERE id = $2
        \`, [remEstado, dbRem.id]);
      }

      return factura;
    });
  }

  /**
   * Actualizar una prefactura (Remisiones)
   */
  async updateFactura(id, data, updatedBy) {
    const { remisiones, condicion_pago, fecha_vencimiento, notas } = data;
    // remisiones debe ser un array de objetos: { id, subtotal, iva_valor, total }

    return await withTransaction(async (client) => {
      // Verificar factura
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden editar prefacturas');

      // 1. Revertir estados de las remisiones anteriores de esta factura
      const oldRemsRes = await client.query('SELECT remision_id, total_rem FROM factura_remisiones WHERE factura_id = $1', [id]);
      
      // Borrar asociaciones anteriores
      await client.query('DELETE FROM factura_remisiones WHERE factura_id = $1', [id]);
      
      // Revertir estados a las remisiones. Si tenían otra factura parcial quedarán en PARCIALMENTE_FACTURADA, sino LIQUIDADA.
      // Para simplificar, calculamos el estado basado en si tienen otros registros en factura_remisiones.
      for (const old of oldRemsRes.rows) {
        const checkOtros = await client.query('SELECT SUM(total_rem) as sum_rem FROM factura_remisiones WHERE remision_id = $1', [old.remision_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_rem || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', [newState, old.remision_id]);
      }

      // Si no envían nuevas remisiones, es un error
      if (!remisiones || remisiones.length === 0) {
        throw new BadRequestError('La factura debe tener al menos una remisión u OT');
      }

      // 2. Validar nuevas remisiones
      const remisionIds = remisiones.map(r => r.id);
      const remSql = \`
        SELECT r.id, r.numero_remision, r.company_id, r.estado,
               r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS saldo_pendiente
        FROM remisiones r
        WHERE r.id = ANY($1)
      \`;
      const remRes = await client.query(remSql, [remisionIds]);
      const dbRems = remRes.rows;

      if (dbRems.length !== remisionIds.length) throw new BadRequestError('Una o más remisiones no existen');

      for (const reqRem of remisiones) {
        const dbRem = dbRems.find(r => r.id === reqRem.id);
        if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbRem.estado)) {
          throw new BadRequestError(\`La remisión \${dbRem.numero_remision} no está disponible para facturar\`);
        }
        if (parseFloat(reqRem.total) > parseFloat(dbRem.saldo_pendiente) + 0.05) {
          throw new BadRequestError(\`El valor a facturar de la remisión \${dbRem.numero_remision} supera su saldo pendiente\`);
        }
      }

      // 3. Calcular totales
      const subtotal = remisiones.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);
      const iva_valor = remisiones.reduce((sum, r) => sum + parseFloat(r.iva_valor), 0);
      const total = remisiones.reduce((sum, r) => sum + parseFloat(r.total), 0);

      // 4. Actualizar factura
      const updFactSql = \`
        UPDATE facturas SET
          subtotal = $1, iva_valor = $2, total = $3,
          condicion_pago = COALESCE($4, condicion_pago),
          fecha_vencimiento = COALESCE($5, fecha_vencimiento),
          notas = COALESCE($6, notas),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      \`;
      const updFactRes = await client.query(updFactSql, [
        subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas, id
      ]);
      const factura = updFactRes.rows[0];

      // 5. Relacionar nuevas remisiones
      for (const reqRem of remisiones) {
        const dbRem = dbRems.find(r => r.id === reqRem.id);
        
        await client.query(\`
          INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
          VALUES ($1, $2, $3, $4, $5, $6)
        \`, [factura.id, dbRem.id, dbRem.numero_remision, reqRem.subtotal, reqRem.iva_valor, reqRem.total]);

        const nuevoSaldo = parseFloat(dbRem.saldo_pendiente) - parseFloat(reqRem.total);
        const remEstado = nuevoSaldo <= 0.05 ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA'; // En prefactura podría quedar como PARCIALMENTE_FACTURADA
        
        await client.query(\`
          UPDATE remisiones SET estado = $1 WHERE id = $2
        \`, [remEstado, dbRem.id]);
      }

      return factura;
    });
  }`;

content = content.replace(createOld, createNew);

fs.writeFileSync(path, content, 'utf8');
console.log('Facturacion repository updated.');
