import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // 1. View definition for equipos_completo
    const viewDef = await client.query(`SELECT pg_get_viewdef('equipos_completo', true) AS definition`);
    console.log('=== EQUIPOS_COMPLETO VIEW DEFINITION ===');
    console.log(viewDef.rows[0].definition);

    // 2. es_servicio_continuo in ordenes_trabajo?
    const esc = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ordenes_trabajo' AND column_name = 'es_servicio_continuo'`);
    console.log('\n=== es_servicio_continuo exists:', esc.rows.length > 0);

    // 3. Check ot_tecnicos columns
    const tech = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ot_tecnicos' ORDER BY ordinal_position`);
    console.log('\n=== OT_TECNICOS COLUMNS ===');
    tech.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type}`));

    // 4. Check remision_operarios columns
    const rop = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'remision_operarios' ORDER BY ordinal_position`);
    console.log('\n=== REMISION_OPERARIOS COLUMNS ===');
    rop.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type}`));

    // 5. OT states distribution
    const otStates = await client.query(`SELECT estado, COUNT(*) FROM ordenes_trabajo WHERE deleted_at IS NULL GROUP BY estado`);
    console.log('\n=== OT STATES ===');
    otStates.rows.forEach(r => console.log(`  ${r.estado}: ${r.count}`));

    // 6. Remisiones states
    const remStates = await client.query(`SELECT estado, COUNT(*) FROM remisiones WHERE deleted_at IS NULL GROUP BY estado`);
    console.log('\n=== REMISION STATES ===');
    remStates.rows.forEach(r => console.log(`  ${r.estado}: ${r.count}`));

    // 7. Check ot_actividades columns
    const act = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ot_actividades' ORDER BY ordinal_position`);
    console.log('\n=== OT_ACTIVIDADES COLUMNS ===');
    act.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type}`));

    // 8. Check pm_actividades_ot columns
    const pmact = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pm_actividades_ot' ORDER BY ordinal_position`);
    console.log('\n=== PM_ACTIVIDADES_OT COLUMNS ===');
    pmact.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type}`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
