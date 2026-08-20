import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/backend/src/modules/facturacion/facturacion.repository.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldConfirmar = `  async confirmarFactura(id, data, confirmedBy) {
    const { numero_factura, fecha_factura, sistema_contable, sistema_contable_id } = data;

    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      // Consecutivo interno será provisto por el usuario (no automático)
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden confirmar prefacturas');

      // 2. Actualizar factura
      const updFactSql = \`
        UPDATE facturas SET
          numero_factura = $1,
          fecha_factura = $2,
          sistema_contable = $3,
          sistema_contable_id = $4,
          estado = 'FACTURADA',
          facturada_por = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *
      \`;
      const updFactRes = await client.query(updFactSql, [
        numero_factura, fecha_factura, sistema_contable, sistema_contable_id, confirmedBy, id
      ]);

      // 4. Actualizar OTs
      await client.query(\`
        UPDATE ordenes_trabajo SET
          estado = 'FACTURADA',
          fecha_facturada = NOW()
        WHERE factura_id = $1
      \`, [id]);

      // 5. Actualizar remisiones
      await client.query(\`
        UPDATE remisiones SET
          estado = 'FACTURADA',
          fecha_facturada = NOW()
        WHERE factura_id = $1
      \`, [id]);

      return updFactRes.rows[0];
    });
  }`;

const newConfirmar = `  async confirmarFactura(id, data, confirmedBy) {
    const { numero_factura, fecha_factura, sistema_contable, sistema_contable_id } = data;

    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden confirmar prefacturas');

      // Actualizar factura
      const updFactSql = \`
        UPDATE facturas SET
          numero_factura = $1,
          fecha_factura = $2,
          sistema_contable = $3,
          sistema_contable_id = $4,
          estado = 'FACTURADA',
          facturada_por = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *
      \`;
      const updFactRes = await client.query(updFactSql, [
        numero_factura, fecha_factura, sistema_contable, sistema_contable_id, confirmedBy, id
      ]);

      // Al confirmar una prefactura a FACTURADA, el estado de las remisiones/OTs
      // ya se gestionó en createPrefactura o updateFactura (quedaron en PARCIALMENTE_FACTURADA).
      // Lo único que debemos hacer es que, si el saldo de la OT o Remisión es <= 0.05, 
      // cambie a FACTURADA.
      
      const remsInFactura = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      for (const row of remsInFactura.rows) {
        const checkSql = \`
          SELECT r.id, r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS saldo_pendiente
          FROM remisiones r
          WHERE r.id = $1
        \`;
        const rCheck = await client.query(checkSql, [row.remision_id]);
        if (rCheck.rows.length > 0) {
          const saldo = parseFloat(rCheck.rows[0].saldo_pendiente);
          if (saldo <= 0.05) {
            await client.query('UPDATE remisiones SET estado = \\'FACTURADA\\', fecha_facturada = COALESCE(fecha_facturada, NOW()) WHERE id = $1', [row.remision_id]);
          }
        }
      }

      const otsInFactura = await client.query('SELECT ot_id FROM factura_ots WHERE factura_id = $1', [id]);
      for (const row of otsInFactura.rows) {
        const checkSql = \`
          SELECT ot.id, liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0) AS saldo_pendiente
          FROM ordenes_trabajo ot
          JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
          WHERE ot.id = $1
        \`;
        const rCheck = await client.query(checkSql, [row.ot_id]);
        if (rCheck.rows.length > 0) {
          const saldo = parseFloat(rCheck.rows[0].saldo_pendiente);
          if (saldo <= 0.05) {
            await client.query('UPDATE ordenes_trabajo SET estado = \\'FACTURADA\\', fecha_facturada = COALESCE(fecha_facturada, NOW()) WHERE id = $1', [row.ot_id]);
          }
        }
      }

      return updFactRes.rows[0];
    });
  }`;

const oldAnular = `  async anularFactura(id, motivo, cancelledBy) {
    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado === 'ANULADA') throw new BadRequestError('La factura ya está anulada');

      // 2. Actualizar factura
      await client.query(\`
        UPDATE facturas SET
          estado = 'ANULADA',
          anulada_por = $1,
          motivo_anulacion = $2,
          updated_at = NOW()
        WHERE id = $3
      \`, [cancelledBy, motivo, id]);

      // 3. Revertir OTs
      await client.query(\`
        UPDATE ordenes_trabajo SET
          estado = 'LIQUIDADA',
          factura_id = NULL,
          fecha_facturada = NULL
        WHERE factura_id = $1
      \`, [id]);

      // 4. Revertir remisiones
      await client.query(\`
        UPDATE remisiones SET
          estado = 'LIQUIDADA',
          factura_id = NULL,
          fecha_facturada = NULL
        WHERE factura_id = $1
      \`, [id]);

      return { success: true };
    });
  }`;

const newAnular = `  async anularFactura(id, motivo, cancelledBy) {
    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado === 'ANULADA') throw new BadRequestError('La factura ya está anulada');

      // 1. Eliminar relaciones para que el saldo se recalcule correctamente
      const remsInFactura = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      const otsInFactura = await client.query('SELECT ot_id FROM factura_ots WHERE factura_id = $1', [id]);
      
      await client.query('DELETE FROM factura_remisiones WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_ots WHERE factura_id = $1', [id]);

      // 2. Actualizar estado de remisiones afectadas
      for (const row of remsInFactura.rows) {
        const checkOtros = await client.query('SELECT SUM(total_rem) as sum_rem FROM factura_remisiones WHERE remision_id = $1', [row.remision_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_rem || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        const fechaFact = sumOtros > 0 ? 'fecha_facturada' : 'NULL';
        await client.query(\`UPDATE remisiones SET estado = $1, fecha_facturada = \${fechaFact} WHERE id = $2\`, [newState, row.remision_id]);
      }

      // 3. Actualizar estado de OTs afectadas
      for (const row of otsInFactura.rows) {
        const checkOtros = await client.query('SELECT SUM(total_ot) as sum_ot FROM factura_ots WHERE ot_id = $1', [row.ot_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_ot || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        const fechaFact = sumOtros > 0 ? 'fecha_facturada' : 'NULL';
        await client.query(\`UPDATE ordenes_trabajo SET estado = $1, fecha_facturada = \${fechaFact} WHERE id = $2\`, [newState, row.ot_id]);
      }

      // 4. Actualizar factura
      await client.query(\`
        UPDATE facturas SET
          estado = 'ANULADA',
          anulada_por = $1,
          motivo_anulacion = $2,
          updated_at = NOW()
        WHERE id = $3
      \`, [cancelledBy, motivo, id]);

      return { success: true };
    });
  }`;

content = content.replace(oldConfirmar, newConfirmar);
content = content.replace(oldAnular, newAnular);

fs.writeFileSync(filePath, content);
console.log("Updated confirmarFactura and anularFactura.");
