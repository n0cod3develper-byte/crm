import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm'
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT
        tc.constraint_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='inventario';
    `);
    console.log("Inventario FKs:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.log("DB ERROR:", err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
