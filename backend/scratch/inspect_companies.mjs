import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });

const cols = await pool.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'companies'
`);
console.log('Columns:');
console.log(cols.rows);

const nulls = await pool.query(`
  SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE name IS NULL OR name = '') AS null_name,
    COUNT(*) FILTER (WHERE nit IS NULL OR nit = '') AS null_nit,
    COUNT(*) FILTER (WHERE address IS NULL OR address = '') AS null_address,
    COUNT(*) FILTER (WHERE regimen IS NULL OR regimen = '') AS null_regimen
  FROM companies
`);
console.log('Null counts:');
console.log(nulls.rows);

await pool.end();
