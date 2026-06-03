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
  '013_bodegas_and_seeds.sql',
  '014_unified_catalog.sql',
  '015_add_marca_to_inventory.sql',
  '016_update_catalog_view.sql',
  '017_optimization_indexes.sql',
  '018_add_image_to_catalog_view.sql',
  '019_inventory_movement_upgrade.sql',

  '020_add_company_to_employees.sql',
  '020_clerk_user_id_nullable.sql',
  '021_add_custom_fields_to_companies.sql',
  '021_inventory_upgrade.sql',
  '022_catalogo_servicios.sql',
  '023_servicios_remision.sql',
  '024_add_remision_fields.sql',
  '025_add_numero_equipo.sql',
  '025_liquidacion_horas_laborales.sql',
  '026_add_tipo_to_catalogo.sql',
  '026_fix_remision_estados.sql',
  '027_add_cantidad_to_catalogo.sql',
  '027_segundo_operario_tiempos.sql',
  '028_liquidacion_horas_laborales.sql',
  '028_segundo_operario_horometros.sql',
  '029_fix_remision_estados.sql',
  '029_segundo_operario_fecha.sql',
  '030_segundo_operario_tiempos.sql',
  '030_turnos_module.sql',
  '031_fix_view_id.sql',
  '031_segundo_operario_horometros.sql',
  '032_desglose_recargos_cst.sql',
  '032_segundo_operario_fecha.sql',
  '033_equipos_campos_ampliados.sql',
  '033_update_view_cst_desglose.sql',
  '034_add_phone2_to_companies.sql',
  '034_historial_equipo.sql',
  '035_servicios_to_facturacion.sql',
  '035_trabajos_detalle_horometro_decimal.sql',
  '036_add_bonificacion_equipo.sql',
  '036_fix_remision_estado_facturada.sql',
  '037_company_new_fields_and_tipo_servicio.sql',
  '037_informes_module.sql',
  '038_add_cantidad_tipo_catalogo_servicios.sql',
  '038_remisiones_catalogo_pro.sql',
  '039_fix_tipo_servicio_check_encoding.sql',
  '039_ot_historial_fields.sql',
  '040_add_missing_modulos.sql'
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
