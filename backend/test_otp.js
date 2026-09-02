const { Pool } = require('pg');
const crypto = require('crypto');
const pool = new Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5432/cargar_crm' });

async function run() {
  const otpCode = '123456';
  const hash = crypto.createHash('sha256').update(otpCode).digest('hex');
  const r = await pool.query(
    `INSERT INTO certificado_otp_tokens (empleado_id, numero_doc, token_hash, correo_enviado, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes') RETURNING id`,
    ['3f356b31-a4a2-4e9c-8d87-a52772fb4e9d', '71398467', hash, 'ralvarezloud@gmail.com']
  );
  console.log('Test token ID:', r.rows[0].id);
  console.log('Test OTP code:', otpCode);
  await pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
