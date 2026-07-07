import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm'
  });
  await client.connect();

  try {
    const res = await client.query(`
      INSERT INTO inventario (
        tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id,
        costo_reposicion, unit_price, stock_actual, stock_minimum,
        precio_servicio, precio_servicio_minimo, unidad_cobro,
        aplica_iva, iva_pct, es_destacado, marca, ubicacion_id,
        tipo_repuesto, responsable_id, referencia_cruzada, equipos_compatibles,
        created_by, area
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *
    `, [
      'PRODUCTO', 'PRD-00001', 'REF-01', 'REF-01', 
      null, // categoria_id
      null, // unidad_medida_id
      0, 0, 0, 0,
      0, 0, null,
      true, 19, false, null, null,
      'N/A', null, '[]', '[]',
      'c85fcb9c-72dc-473d-9d41-9fb98072eb04', // an arbitrary uuid for created_by
      'MANTENIMIENTO'
    ]);
    console.log("Success:", res.rows[0]);
  } catch (err) {
    console.log("DB ERROR:", err.message);
    console.log("Constraint:", err.constraint);
    console.log("Code:", err.code);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
