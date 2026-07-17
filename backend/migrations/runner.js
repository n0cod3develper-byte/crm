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
  '019_inventory_movement_upgrade.sql',
  '020_clerk_user_id_nullable.sql',
  '021_inventory_upgrade.sql',
  '022_catalogo_servicios.sql',
  '023_servicios_remision.sql',
  '024_add_remision_fields.sql',
  '025_liquidacion_horas_laborales.sql',
  '026_fix_remision_estados.sql',
  '027_segundo_operario_tiempos.sql',
  '028_segundo_operario_horometros.sql',
  '029_segundo_operario_fecha.sql',
  '030_turnos_module.sql',
  '031_fix_view_id.sql',
  '032_desglose_recargos_cst.sql',
  '033_update_view_cst_desglose.sql',
  '034_add_phone2_to_companies.sql',
  '035_servicios_to_facturacion.sql',
  '036_fix_remision_estado_facturada.sql',
  '037_company_new_fields_and_tipo_servicio.sql',
  '038_add_cantidad_tipo_catalogo_servicios.sql',
  '039_fix_tipo_servicio_check_encoding.sql',
  '040_equipos_extended_fields.sql',
  '041_soat_fields.sql',
  '042_areas_inventario.sql',
  '043_sistemas_asset_fields.sql',
  '044_fix_sistemas_missing_columns.sql',
  '045_employee_document_fields.sql',
  '046_fix_responsable_fk.sql',
  '047_sst_fields.sql',
  '048_locativo_module.sql',
  '049_activity_log.sql',
  '050_mantenimientos_programados_module.sql',
  '051_seed_areas_inventario.sql',
  '052_add_invitation_columns.sql',
  '053_drop_fullname_notnull.sql',
  '054_add_missing_modules.sql',
  '055_add_email_fields_to_companies.sql',
  '056_company_service_addresses_and_remision_relations.sql',
  '057_remision_multiples_servicios.sql',
  '058_remision_servicios_fields.sql',
  '059_item_iva.sql',
  '060_update_equipos_constraints.sql',
  '061_companies_required_fields.sql',
  '062_equipos_bonificacion_hora.sql',
  '063_servicios_equipo_optional.sql',
  '064_servicios_bonificacion_hora.sql',
  '065_soat_email_notifications.sql',
  '066_prompt_specs.sql',
  '067_roles_dinamicos.sql',
  '068_proveedores_nuevos_campos.sql',
  '069_centros_costos_module.sql',
  '070_centros_costos_permissions.sql',
  '071_centro_costo_items.sql',
  '072_supplier_quotes_module.sql',
  '073_quote_items_proveedor.sql',
  '074_supplier_quote_items_proveedor.sql',
  '075_supplier_quote_items_empresa.sql',
  '076_add_estibador_tipo_equipo.sql',
  '076_supplier_quotes_reestructura.sql',
  '077_supplier_quotes_numero.sql',
  '078_supplier_quote_items_iva.sql',
  '079_supplier_quotes_global_iva.sql',
  '080_quote_items_extended_fields.sql',
  '081_fix_autorizado_por_fk.sql',
  '082_add_supplier_quote_id.sql',
  '083_ot_liquidacion_quotes.sql'
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
