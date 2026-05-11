// IMPORTANTE: dotenv debe cargarse ANTES de cualquier import que use process.env
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env desde la raíz del backend
const dotenvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(dotenvPath)) {
  const dotenv = require('dotenv');
  dotenv.config({ path: dotenvPath });
  console.log(`📄 Cargando variables desde: ${dotenvPath}`);
} else {
  console.warn('⚠️  No se encontró .env, usando variables de entorno del sistema');
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida. Verifica tu archivo .env');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

// Archivos de migración en orden
const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_support_module.sql',
  '003_employees_module.sql',
  '004_add_identification.sql',
  '004_fix_support_assignment.sql',
  '005_equipos_module.sql',
  '006_mantenimiento_module.sql',
  '007_proveedores_compras_module.sql',
  '008_preventivo_module.sql',
  '009_fix_horometro_frecuencia.sql',
  '010_add_password_to_users.sql',


  '011_clerk_rbac.sql',
  '012_facturacion_module.sql',
  '013_unified_catalog.sql',
  '014_bodegas_and_seeds.sql',
  '015_add_marca_to_inventory.sql',
  '016_update_catalog_view.sql',
  '017_optimization_indexes.sql',
  '018_add_image_to_catalog_view.sql',


  '019_add_company_to_employees.sql',
  '020_add_custom_fields_to_companies.sql',
  '021_catalogo_servicios.sql',
  '022_servicios_remision.sql',
  '023_add_remision_fields.sql',
  '024_add_numero_equipo.sql',
  '025_add_tipo_to_catalogo.sql',
  '026_add_cantidad_to_catalogo.sql',
  '027_liquidacion_horas_laborales.sql',
  '028_fix_remision_estados.sql',
  '029_segundo_operario_tiempos.sql',
  '030_segundo_operario_horometros.sql',
  '031_segundo_operario_fecha.sql',
];

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        SERIAL PRIMARY KEY,
      filename  TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const res = await client.query('SELECT filename FROM _migrations ORDER BY id');
  return new Set(res.rows.map(r => r.filename));
}

async function runMigrations() {
  console.log('🚀 Iniciando runner de migraciones...');
  console.log(`🔗 Conectando a: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);

  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    let count = 0;
    for (const filename of MIGRATION_FILES) {
      if (applied.has(filename)) {
        console.log(`⏭️  Saltando (ya aplicada): ${filename}`);
        continue;
      }

      const filePath = path.join(__dirname, filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Archivo no encontrado, saltando: ${filename}`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`⚙️  Aplicando: ${filename}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`✅ ${filename} aplicada correctamente`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error en ${filename}: ${err.message}`);
        throw err;
      }
    }

    if (count === 0) {
      console.log('✅ La base de datos ya está al día. No hay migraciones nuevas.');
    } else {
      console.log(`\n🎉 ${count} migración(es) aplicada(s) con éxito.`);
    }

  } catch (err) {
    console.error('❌ Migración fallida:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
