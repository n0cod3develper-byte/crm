import 'dotenv/config';
import { clerkClient } from '@clerk/express';
import pkg from 'pg';
const { Client } = pkg;

async function sync() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Conectado a la base de datos...');

    const response = await clerkClient.users.getUserList();
    const users = response.data;
    console.log(`Encontrados ${users.length} usuarios en Clerk.`);

    for (const u of users) {
      const email = u.emailAddresses[0]?.emailAddress;
      const rolId = u.publicMetadata?.pending_rol_id || null;
      
      console.log(`Sincronizando: ${email} (${u.id}) - Rol: ${rolId}`);

      const sql = `
        INSERT INTO usuarios_crm (clerk_user_id, nombre, apellido, email, avatar_url, rol_id, estado)
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
        ON CONFLICT (clerk_user_id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          apellido = EXCLUDED.apellido,
          email = EXCLUDED.email,
          rol_id = COALESCE(usuarios_crm.rol_id, EXCLUDED.rol_id),
          estado = 'ACTIVO'
      `;

      await client.query(sql, [
        u.id, 
        u.firstName || '', 
        u.lastName || '', 
        email, 
        u.imageUrl, 
        rolId
      ]);
    }

    console.log('Sincronización completada con éxito.');
  } catch (err) {
    console.error('Error durante la sincronización:', err);
  } finally {
    await client.end();
  }
}

sync();
