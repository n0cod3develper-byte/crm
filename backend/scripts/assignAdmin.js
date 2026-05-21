// assignAdmin.js
// Script to assign the admin role to a user by email.
// Usage: node backend/scripts/assignAdmin.js <email>

import { query, withTransaction } from '../src/config/database.js';

async function getAdminRoleId() {
  const res = await query("SELECT id FROM roles WHERE slug = 'admin' LIMIT 1");
  if (res.rows.length === 0) throw new Error('Admin role not found');
  return res.rows[0].id;
}

async function assignAdmin(email) {
  const adminRoleId = await getAdminRoleId();
  await withTransaction(async (client) => {
    const sql = `UPDATE users SET rol_id = $2, updated_at = NOW() WHERE email = $1 RETURNING *`;
    const result = await client.query(sql, [email, adminRoleId]);
    if (result.rows.length === 0) {
      throw new Error(`User with email ${email} not found`);
    }
    console.log('User updated:', result.rows[0]);
  });
}

const emailArg = process.argv[2];
if (!emailArg) {
  console.error('Please provide an email as the first argument');
  process.exit(1);
}

assignAdmin(emailArg)
  .then(() => {
    console.log('Role assignment completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
