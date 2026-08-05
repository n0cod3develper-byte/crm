// Script para liberar equipos atascados en ALQUILADO
// Solo libera aquellos que NO tienen remisiones PENDIENTE o EN_PROCESO
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });

async function fix() {
  // Encontrar equipos ALQUILADOS que no tengan remisiones realmente activas
  const stuck = await pool.query(`
    SELECT e.id, e.serie, e.serial, e.marca, e.modelo
    FROM equipos e
    WHERE e.estado = 'ALQUILADO'
      AND NOT EXISTS (
        SELECT 1 FROM remisiones r
        WHERE r.equipo_id = e.id
          AND r.deleted_at IS NULL
          AND r.estado IN ('PENDIENTE', 'EN_PROCESO')
      )
  `);

  console.log(`\n🔍 Equipos atascados a liberar: ${stuck.rows.length}\n`);

  for (const eq of stuck.rows) {
    await pool.query(`
      UPDATE equipos SET
        estado = 'OPERATIVO',
        motivo_estado = 'Liberado automáticamente - reparación de estado atascado por borradores',
        fecha_cambio_estado = CURRENT_DATE,
        actualizado_por = 'Sistema (reparación)',
        updated_at = NOW()
      WHERE id = $1
    `, [eq.id]);

    await pool.query(`
      INSERT INTO equipos_historial_estado (equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por)
      VALUES ($1, 'ALQUILADO', 'OPERATIVO', 'Liberado - no tenía remisiones activas (solo borradores/cerradas)', 'Sistema (reparación)')
    `, [eq.id]);

    console.log(`   ✅ ${eq.serie || eq.serial} (${eq.marca} ${eq.modelo}) → OPERATIVO`);
  }

  console.log(`\n🎉 Listo. ${stuck.rows.length} equipo(s) liberados.`);
  pool.end();
}

fix().catch(err => { console.error(err); pool.end(); });
