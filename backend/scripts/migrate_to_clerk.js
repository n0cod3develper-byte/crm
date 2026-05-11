import 'dotenv/config';
import { clerkClient } from '@clerk/express';
import { query, withTransaction } from '../src/config/database.js';

/**
 * Script para migrar usuarios locales a Clerk
 * 1. Lee usuarios de la tabla antigua
 * 2. Los crea en Clerk usando el Backend API
 * 3. Los vincula en la nueva tabla usuarios_crm
 */

async function migrar() {
  console.log('🚀 Iniciando migración a Clerk...');

  try {
    // 1. Obtener usuarios que NO tengan clerk_user_id (o de la tabla antigua)
    // Asumimos tabla 'usuarios' con: id, email, full_name, password (hash)
    const oldUsers = await query("SELECT * FROM usuarios");
    console.log(`Encontrados ${oldUsers.rows.length} usuarios para migrar.`);

    for (const user of oldUsers.rows) {
      console.log(`Migrando: ${user.email}...`);

      try {
        // 2. Crear en Clerk
        // NOTA: Clerk permite importar el hash bcrypt directamente
        const clerkUser = await clerkClient.users.createUser({
          emailAddress: [user.email],
          firstName: user.full_name?.split(' ')[0] || '',
          lastName: user.full_name?.split(' ').slice(1).join(' ') || '',
          password: 'TemporaryPassword123!', // O importar el hash si usas la API de Importación
          // Para importar hashes reales se usa el endpoint de importación de Clerk, 
          // pero para este script usaremos la creación estándar y pediremos reset de pass
          // o usaremos skipPasswordChecks si está disponible.
          skipPasswordRequirement: false, 
        });

        // 3. Insertar/Actualizar en usuarios_crm
        const sql = `
          INSERT INTO usuarios_crm (clerk_user_id, nombre, apellido, email, estado)
          VALUES ($1, $2, $3, $4, 'ACTIVO')
          ON CONFLICT (email) DO UPDATE SET
            clerk_user_id = EXCLUDED.clerk_user_id
        `;
        
        const [nombre, ...apellidoParts] = (user.full_name || '').split(' ');
        await query(sql, [
          clerkUser.id,
          nombre,
          apellidoParts.join(' '),
          user.email
        ]);

        console.log(`✅ ${user.email} migrado con ID: ${clerkUser.id}`);
      } catch (err) {
        if (err.errors?.[0]?.code === 'form_identifier_exists') {
          console.log(`ℹ️ ${user.email} ya existe en Clerk. Saltando...`);
        } else {
          console.error(`❌ Error migrando ${user.email}:`, err.message);
        }
      }
    }

    console.log('✨ Migración completada.');
  } catch (err) {
    console.error('💥 Error fatal en la migración:', err);
  } finally {
    process.exit();
  }
}

migrar();
