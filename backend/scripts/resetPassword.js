import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });

async function resetPassword() {
  const email = 'admin@cargar.com';
  const newPassword = 'Admin123*';

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, nombre',
      [hash, email]
    );

    if (result.rows.length > 0) {
      console.log('Contraseña actualizada exitosamente para:');
      console.log(`  Email: ${result.rows[0].email}`);
      console.log(`  Nueva Contraseña: ${newPassword}`);
    } else {
      console.log('ERROR: Usuario no encontrado');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
