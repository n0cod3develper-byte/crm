import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // 1. equipos columns
    const eq = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'equipos' ORDER BY ordinal_position`);
    console.log('=== EQUIPOS COLUMNS ===');
    eq.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable: ${r.is_nullable}`));

    // 2. centros_costos columns
    const cc = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'centros_costos' ORDER BY ordinal_position`);
    console.log('\n=== CENTROS_COSTOS COLUMNS ===');
    cc.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable: ${r.is_nullable}`));

    // 3. ordenes_trabajo columns
    const ot = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'ordenes_trabajo' ORDER BY ordinal_position`);
    console.log('\n=== ORDENES_TRABAJO COLUMNS ===');
    ot.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable: ${r.is_nullable}`));

    // 4. remisiones columns
    const rem = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'remisiones' ORDER BY ordinal_position`);
    console.log('\n=== REMISIONES COLUMNS ===');
    rem.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable: ${r.is_nullable}`));

    // 5. ot_liquidacion columns
    const liq = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'ot_liquidacion' ORDER BY ordinal_position`);
    console.log('\n=== OT_LIQUIDACION COLUMNS ===');
    liq.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable: ${r.is_nullable}`));

    // 6. Check foreign keys on equipos
    const fks = await client.query(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'equipos' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    console.log('\n=== EQUIPOS FOREIGN KEYS ===');
    fks.rows.forEach(r => console.log(`  ${r.column_name} -> ${r.foreign_table}(${r.foreign_column})`));

    // 7. Check if centro_costo_id exists on equipos
    const ccCheck = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'equipos' AND column_name LIKE '%centro%'`);
    console.log('\n=== EQUIPOS CENTRO_COSTO COLUMNS ===');
    ccCheck.rows.forEach(r => console.log(`  ${r.column_name}`));
    if (ccCheck.rows.length === 0) console.log('  (NONE - needs migration)');

    // 8. Check equipos_completo view
    const view = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'equipos_completo' ORDER BY ordinal_position`);
    console.log('\n=== EQUIPOS_COMPLETO VIEW COLUMNS ===');
    view.rows.forEach(r => console.log(`  ${r.column_name}`));

    // 9. Count existing equipos
    const count = await client.query(`SELECT COUNT(*) as total FROM equipos WHERE deleted_at IS NULL`);
    console.log(`\n=== TOTAL EQUIPOS: ${count.rows[0].total} ===`);

    // 10. Check ot_repuestos_insumos
    const rep = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ot_repuestos_insumos' ORDER BY ordinal_position`);
    console.log('\n=== OT_REPUESTOS_INSUMOS COLUMNS ===');
    rep.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type}`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
