import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/backend/src/modules/facturacion/facturacion.repository.js';
let content = fs.readFileSync(filePath, 'utf8');

const createOld = `  async createPrefactura(data, createdBy) {
    const { empresa_id, ot_ids, condicion_pago, fecha_vencimiento, notas, numero_factura, fecha_factura } = data;

    return await withTransaction(async (client) => {
      // 1. Validar OTs
      const otSql = \`
        SELECT ot.id, ot.consecutivo, ot.empresa_id, ot.estado, ot.factura_id,
               liq.subtotal, liq.impuesto_valor as iva_valor, liq.total_final as total
        FROM ordenes_trabajo ot
        JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
        WHERE ot.id = ANY($1)
      \`;
      const otRes = await client.query(otSql, [ot_ids]);
      const ots = otRes.rows;

      if (ots.length !== ot_ids.length) {
        throw new BadRequestError('Una o más OTs no existen o no están liquidadas');
      }

      for (const ot of ots) {
        if (ot.empresa_id !== empresa_id) {
          throw new BadRequestError(\`La OT \${ot.consecutivo} no pertenece a la empresa seleccionada\`);
        }
        if (ot.estado !== 'LIQUIDADA' || ot.factura_id !== null) {
          throw new BadRequestError(\`La OT \${ot.consecutivo} no está disponible para facturar\`);
        }
      }

      
      // 2. Generar consecutivo interno
      const consRes = await client.query(\`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      \`);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = \`FAC-\${String(nro).padStart(5, '0')}\`;

      // 3. Calcular totales
      const subtotal = ots.reduce((sum, ot) => sum + parseFloat(ot.subtotal), 0);
      const iva_valor = ots.reduce((sum, ot) => sum + parseFloat(ot.iva_valor), 0);
      const total = ots.reduce((sum, ot) => sum + parseFloat(ot.total), 0);

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

      // 5. Relacionar OTs y snapshot financiero
      for (const ot of ots) {
        await client.query(\`
          INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
          VALUES ($1, $2, $3, $4, $5, $6)
        \`, [factura.id, ot.id, ot.consecutivo, ot.subtotal, ot.iva_valor, ot.total]);

        // Actualizar OT
        const otEstado = numero_factura ? 'FACTURADA' : 'LIQUIDADA';
        const fechaFacturada = numero_factura ? 'NOW()' : 'NULL';
        
        await client.query(\`
          UPDATE ordenes_trabajo SET 
            factura_id = $1,
            estado = $2,
            fecha_facturada = \${fechaFacturada}
          WHERE id = $3
        \`, [factura.id, otEstado, ot.id]);
      }

      return factura;
    });
  }`;

const createNew = `  async createPrefactura(data, createdBy) {
    const { empresa_id, ots: reqOts, ot_ids, condicion_pago, fecha_vencimiento, notas, numero_factura, fecha_factura } = data;

    // Si viene ot_ids (antiguo), lo convertimos a formato ots
    let otsList = reqOts;
    if (!otsList && ot_ids) {
      otsList = ot_ids.map(id => ({ id })); // El backend buscará los totales completos
    }

    return await withTransaction(async (client) => {
      // 1. Validar OTs
      const otIds = otsList.map(o => o.id);
      const otSql = \`
        SELECT ot.id, ot.consecutivo, ot.empresa_id, ot.estado,
               liq.subtotal as liq_subtotal, liq.impuesto_valor as liq_iva, liq.total_final as liq_total,
               liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0) AS saldo_pendiente
        FROM ordenes_trabajo ot
        JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
        WHERE ot.id = ANY($1)
      \`;
      const otRes = await client.query(otSql, [otIds]);
      const dbOts = otRes.rows;

      if (dbOts.length !== otIds.length) {
        throw new BadRequestError('Una o más OTs no existen o no están liquidadas');
      }

      // Rellenar valores si vinieron por ot_ids sin totales
      otsList = otsList.map(reqOt => {
        const dbOt = dbOts.find(o => o.id === reqOt.id);
        if (!reqOt.total) {
          return {
            id: reqOt.id,
            subtotal: dbOt.liq_subtotal,
            iva_valor: dbOt.liq_iva,
            total: dbOt.liq_total
          };
        }
        return reqOt;
      });

      for (const reqOt of otsList) {
        const dbOt = dbOts.find(o => o.id === reqOt.id);
        if (dbOt.empresa_id !== empresa_id) {
          throw new BadRequestError(\`La OT \${dbOt.consecutivo} no pertenece a la empresa seleccionada\`);
        }
        if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbOt.estado)) {
          throw new BadRequestError(\`La OT \${dbOt.consecutivo} no está disponible para facturar\`);
        }
        if (parseFloat(reqOt.total) > parseFloat(dbOt.saldo_pendiente) + 0.05) {
          throw new BadRequestError(\`El valor a facturar de la OT \${dbOt.consecutivo} supera su saldo pendiente\`);
        }
      }

      // 2. Generar consecutivo interno
      const consRes = await client.query(\`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      \`);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = \`FAC-\${String(nro).padStart(5, '0')}\`;

      // 3. Calcular totales
      const subtotal = otsList.reduce((sum, ot) => sum + parseFloat(ot.subtotal), 0);
      const iva_valor = otsList.reduce((sum, ot) => sum + parseFloat(ot.iva_valor), 0);
      const total = otsList.reduce((sum, ot) => sum + parseFloat(ot.total), 0);

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

      // 5. Relacionar OTs y snapshot financiero
      for (const reqOt of otsList) {
        const dbOt = dbOts.find(o => o.id === reqOt.id);

        await client.query(\`
          INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
          VALUES ($1, $2, $3, $4, $5, $6)
        \`, [factura.id, dbOt.id, dbOt.consecutivo, reqOt.subtotal, reqOt.iva_valor, reqOt.total]);

        // Actualizar OT
        const nuevoSaldo = parseFloat(dbOt.saldo_pendiente) - parseFloat(reqOt.total);
        const otEstado = nuevoSaldo <= 0.05 ? (numero_factura ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA') : 'PARCIALMENTE_FACTURADA';
        const fechaFacturada = numero_factura ? 'NOW()' : 'NULL';
        
        await client.query(\`
          UPDATE ordenes_trabajo SET 
            estado = $2,
            fecha_facturada = COALESCE(fecha_facturada, \${fechaFacturada})
          WHERE id = $1
        \`, [dbOt.id, otEstado]);
      }

      return factura;
    });
  }`;

const updateOld = `  async updateFactura(id, data, updatedBy) {
    const { remisiones, condicion_pago, fecha_vencimiento, notas } = data;

    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden editar prefacturas');

      // 1. Revertir estados de remisiones anteriores
      const oldRemsRes = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_remisiones WHERE factura_id = $1', [id]);
      
      for (const old of oldRemsRes.rows) {
        const checkOtros = await client.query('SELECT SUM(total_rem) as sum_rem FROM factura_remisiones WHERE remision_id = $1', [old.remision_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_rem || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', [newState, old.remision_id]);
      }

      if (!remisiones || remisiones.length === 0) throw new BadRequestError('La factura debe tener al menos una remisión');

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
        const remEstado = nuevoSaldo <= 0.05 ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA';
        
        await client.query(\`
          UPDATE remisiones SET estado = $1 WHERE id = $2
        \`, [remEstado, dbRem.id]);
      }

      return factura;
    });
  }`;

const updateNew = `  async updateFactura(id, data, updatedBy) {
    const { remisiones, ots, condicion_pago, fecha_vencimiento, notas } = data;

    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden editar prefacturas');

      // Revertir estados de remisiones anteriores si las hay
      const oldRemsRes = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_remisiones WHERE factura_id = $1', [id]);
      for (const old of oldRemsRes.rows) {
        const checkOtros = await client.query('SELECT SUM(total_rem) as sum_rem FROM factura_remisiones WHERE remision_id = $1', [old.remision_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_rem || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', [newState, old.remision_id]);
      }

      // Revertir estados de OTs anteriores si las hay
      const oldOtsRes = await client.query('SELECT ot_id FROM factura_ots WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_ots WHERE factura_id = $1', [id]);
      for (const old of oldOtsRes.rows) {
        const checkOtros = await client.query('SELECT SUM(total_ot) as sum_ot FROM factura_ots WHERE ot_id = $1', [old.ot_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_ot || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE ordenes_trabajo SET estado = $1 WHERE id = $2', [newState, old.ot_id]);
      }

      if ((!remisiones || remisiones.length === 0) && (!ots || ots.length === 0)) {
        throw new BadRequestError('La factura debe tener al menos un ítem (remisión u orden de trabajo)');
      }

      let subtotal = 0;
      let iva_valor = 0;
      let total = 0;

      // 2. Procesar nuevas remisiones
      if (remisiones && remisiones.length > 0) {
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

        subtotal += remisiones.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);
        iva_valor += remisiones.reduce((sum, r) => sum + parseFloat(r.iva_valor), 0);
        total += remisiones.reduce((sum, r) => sum + parseFloat(r.total), 0);
        
        // Guardar remisiones en BD temporalmente
        for (const reqRem of remisiones) {
          const dbRem = dbRems.find(r => r.id === reqRem.id);
          await client.query(\`
            INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
            VALUES ($1, $2, $3, $4, $5, $6)
          \`, [id, dbRem.id, dbRem.numero_remision, reqRem.subtotal, reqRem.iva_valor, reqRem.total]);

          const nuevoSaldo = parseFloat(dbRem.saldo_pendiente) - parseFloat(reqRem.total);
          const remEstado = nuevoSaldo <= 0.05 ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA';
          await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', [remEstado, dbRem.id]);
        }
      }

      // 3. Procesar nuevas OTs
      if (ots && ots.length > 0) {
        const otIds = ots.map(o => o.id);
        const otSql = \`
          SELECT ot.id, ot.consecutivo, ot.estado,
                 liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0) AS saldo_pendiente
          FROM ordenes_trabajo ot
          JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
          WHERE ot.id = ANY($1)
        \`;
        const otRes = await client.query(otSql, [otIds]);
        const dbOts = otRes.rows;

        if (dbOts.length !== otIds.length) throw new BadRequestError('Una o más OTs no existen');

        for (const reqOt of ots) {
          const dbOt = dbOts.find(o => o.id === reqOt.id);
          if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbOt.estado)) {
            throw new BadRequestError(\`La OT \${dbOt.consecutivo} no está disponible para facturar\`);
          }
          if (parseFloat(reqOt.total) > parseFloat(dbOt.saldo_pendiente) + 0.05) {
            throw new BadRequestError(\`El valor a facturar de la OT \${dbOt.consecutivo} supera su saldo pendiente\`);
          }
        }

        subtotal += ots.reduce((sum, o) => sum + parseFloat(o.subtotal), 0);
        iva_valor += ots.reduce((sum, o) => sum + parseFloat(o.iva_valor), 0);
        total += ots.reduce((sum, o) => sum + parseFloat(o.total), 0);

        // Guardar OTs en BD
        for (const reqOt of ots) {
          const dbOt = dbOts.find(o => o.id === reqOt.id);
          await client.query(\`
            INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
            VALUES ($1, $2, $3, $4, $5, $6)
          \`, [id, dbOt.id, dbOt.consecutivo, reqOt.subtotal, reqOt.iva_valor, reqOt.total]);

          const nuevoSaldo = parseFloat(dbOt.saldo_pendiente) - parseFloat(reqOt.total);
          const otEstado = nuevoSaldo <= 0.05 ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA';
          await client.query('UPDATE ordenes_trabajo SET estado = $1 WHERE id = $2', [otEstado, dbOt.id]);
        }
      }

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
      return updFactRes.rows[0];
    });
  }`;

if (content.includes(createOld) && content.includes(updateOld)) {
  content = content.replace(createOld, createNew);
  content = content.replace(updateOld, updateNew);
  fs.writeFileSync(filePath, content);
  console.log("Facturacion repository updated.");
} else {
  console.log("Could not find blocks to replace.");
}
