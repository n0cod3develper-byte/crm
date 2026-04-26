import 'dotenv/config';
import { query } from './src/config/database.js';

async function syncClerkUsers() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('No CLERK_SECRET_KEY found in .env');
    process.exit(1);
  }

  console.log('Fetching users from Clerk...');
  const res = await fetch('https://api.clerk.com/v1/users', {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to fetch from Clerk:', err);
    process.exit(1);
  }

  const users = await res.json();
  console.log(`Found ${users.length} user(s) in Clerk.`);

  // Get admin role ID
  const roleRes = await query(`SELECT id FROM roles WHERE slug = 'admin' LIMIT 1`);
  const adminRoleId = roleRes.rows[0].id;
  console.log('Admin Role ID:', adminRoleId);

  for (const u of users) {
    const email = u.email_addresses[0]?.email_address;
    const firstName = u.first_name || '';
    const lastName = u.last_name || '';
    const imageUrl = u.image_url || '';

    const sql = `
      INSERT INTO usuarios_crm (clerk_user_id, email, nombre, apellido, avatar_url, rol_id, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        rol_id = EXCLUDED.rol_id,
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        avatar_url = EXCLUDED.avatar_url,
        estado = 'ACTIVO',
        updated_at = NOW()
    `;
    await query(sql, [u.id, email, firstName, lastName, imageUrl, adminRoleId]);
    console.log(`Synced user ${email} as admin.`);
  }

  console.log('Done!');
  process.exit(0);
}

syncClerkUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
