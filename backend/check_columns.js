import { query } from './src/config/database.js';

async function checkColumns() {
  try {
    const res = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_items'
    `);
    console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

checkColumns();
