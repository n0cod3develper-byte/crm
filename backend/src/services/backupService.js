import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import util from 'util';
import cron from 'node-cron';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const execAsync = util.promisify(exec);

// Path logic to support Windows local dev while fulfilling the Linux production requirement
const BACKUP_DIR = env.NODE_ENV === 'development' && process.platform === 'win32'
  ? path.resolve(process.cwd(), '../cargar-crm-backups')
  : '/var/backups/cargar-crm';

const RETENTION_DAYS = 7;

/**
 * Asegura que el directorio de backups exista
 */
const ensureBackupDirExists = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`Directorio de backups creado en: ${BACKUP_DIR}`);
  }
};

/**
 * Verifica si pg_dump está disponible en el sistema
 */
function isPgDumpAvailable() {
  try {
    const result = execSync('pg_dump --version', { encoding: 'utf8', timeout: 5000 });
    return result.startsWith('pg_dump');
  } catch {
    return false;
  }
}

/**
 * Obtiene las tablas en orden topológico según dependencias FK
 * para que al restaurar no haya violaciones de llaves foráneas.
 */
async function getTopologicalTableOrder() {
  // Obtener todas las tablas base
  const tablesResult = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const allTables = tablesResult.rows.map(r => r.table_name);

  // Obtener dependencias FK
  const fkResult = await query(`
    SELECT
      tc.table_name AS source_table,
      ccu.table_name AS target_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
  `);

  // Construir grafo de dependencias
  const dependsOn = {};
  for (const t of allTables) dependsOn[t] = new Set();
  for (const fk of fkResult.rows) {
    if (fk.source_table !== fk.target_table) { // ignorar auto-referencias
      dependsOn[fk.source_table]?.add(fk.target_table);
    }
  }

  // Orden topológico (Kahn's algorithm)
  const inDegree = {};
  for (const t of allTables) inDegree[t] = 0;
  for (const t of allTables) {
    for (const dep of dependsOn[t] || []) {
      if (dependsOn[dep]) inDegree[t]++;
    }
  }

  const queue = allTables.filter(t => inDegree[t] === 0);
  const sorted = [];
  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);
    for (const other of allTables) {
      if ((dependsOn[other] || new Set()).has(node)) {
        inDegree[other]--;
        if (inDegree[other] === 0) queue.push(other);
      }
    }
  }

  // Si hay ciclos (auto-referencias), agregar las que falten al final
  for (const t of allTables) {
    if (!sorted.includes(t)) sorted.push(t);
  }

  return sorted;
}

/**
 * Genera un backup de la base de datos usando Node.js puro (pg library)
 * No requiere pg_dump ni gzip instalados.
 */
async function generateBackupNodeJs(adminUserId) {
  const date = new Date();
  const timestamp = date.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const dbName = new URL(env.DATABASE_URL).pathname.split('/')[1] || 'database';
  const filename = `${timestamp}_${dbName}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  logger.info('Generando backup vía Node.js (pg_dump no disponible)', { filename, adminUserId });

  // Obtener todas las tablas del schema public en orden topológico (dependencias FK primero)
  const tableNames = await getTopologicalTableOrder();
  let sqlContent = `-- Backup generado el ${date.toISOString()}\n`;
  sqlContent += `-- Base de datos: ${dbName}\n`;
  sqlContent += `-- Generado por: ${adminUserId}\n\n`;
  sqlContent += `BEGIN;\n\n`;

  for (const tableName of tableNames) {
    try {
      // Obtener estructura de columnas
      const colsResult = await query(`
        SELECT column_name, data_type, character_maximum_length,
               is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const columns = colsResult.rows.map(r => r.column_name);
      const colList = columns.map(c => `"${c}"`).join(', ');

      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      sqlContent += `-- Tabla: ${tableName}\n`;
      
      while (hasMore) {
        const dataResult = await query(
          `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`,
          [PAGE_SIZE, offset]
        );

        if (dataResult.rows.length === 0) {
          hasMore = false;
          continue;
        }

        for (const row of dataResult.rows) {
          const values = columns.map(col => formatValue(row[col]));
          sqlContent += `INSERT INTO "${tableName}" (${colList}) VALUES (${values.join(', ')});\n`;
        }
        
        offset += PAGE_SIZE;
      }
      sqlContent += '\n';
    } catch (tableErr) {
      logger.warn(`Error exportando tabla ${tableName}`, { error: tableErr.message });
      // Continuar con la siguiente tabla
    }
  }

  // Actualizar secuencias auto-incrementales
  try {
    const seqResult = await query(`
      SELECT sequence_name, table_name, column_name
      FROM information_schema.columns c
      JOIN information_schema.sequences s ON s.sequence_schema = 'public'
        AND s.sequence_name = c.table_name || '_' || c.column_name || '_seq'
      WHERE c.table_schema = 'public' AND c.column_default LIKE 'nextval(%';
    `);
    for (const seq of seqResult.rows) {
      const maxResult = await query(`SELECT COALESCE(MAX("${seq.column_name}"), 0) AS max_id FROM "${seq.table_name}"`);
      const maxId = maxResult.rows[0].max_id;
      sqlContent += `SELECT setval('${seq.sequence_name}', ${maxId}, true);\n`;
    }
  } catch (seqErr) {
    logger.warn('Error actualizando secuencias', { error: seqErr.message });
  }

  sqlContent += 'COMMIT;\n';

  fs.writeFileSync(filepath, sqlContent, 'utf8');
  logger.info('Backup Node.js generado exitosamente', { filename, size: sqlContent.length, adminUserId });

  return { success: true, filename, message: 'Backup generado correctamente' };
}

/**
 * Formatea un valor para INSERT SQL escapando strings y manejando nulls
 */
function formatValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) {
    // ISO 8601 que PostgreSQL entiende para TIMESTAMPTZ
    return `'${val.toISOString()}'`;
  }
  // Escapar comillas simples duplicándolas
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Genera un backup de la base de datos
 * Usa pg_dump si está disponible, si no usa Node.js puro.
 */
export const generateBackup = async (adminUserId = 'SYSTEM') => {
  try {
    ensureBackupDirExists();

    const date = new Date();
    const timestamp = date.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const dbName = new URL(env.DATABASE_URL).pathname.split('/')[1] || 'database';
    const filename = `${timestamp}_${dbName}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    logger.info(`Iniciando backup de base de datos...`, { filename, adminUserId });

    // Intentar con pg_dump primero
    if (isPgDumpAvailable()) {
      try {
        await execAsync(`pg_dump "${env.DATABASE_URL}" -f "${filepath}"`);
        logger.info('Backup generado con pg_dump', { filename, adminUserId });
        await cleanOldBackups();
        return { success: true, filename, message: 'Backup generado correctamente' };
      } catch (pgDumpErr) {
        logger.warn('pg_dump disponible pero falló, usando fallback Node.js', { error: pgDumpErr.message });
        return await generateBackupNodeJs(adminUserId);
      }
    }

    // Fallback: Node.js puro
    return await generateBackupNodeJs(adminUserId);
  } catch (error) {
    logger.error('Error generando backup', { error: error.message, adminUserId });
    throw error;
  }
};

/**
 * Limpia los backups manteniendo solo los últimos 7 días
 */
const cleanOldBackups = async () => {
  try {
    ensureBackupDirExists();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        return { name: f, path: filePath, ctime: stats.ctime };
      })
      .sort((a, b) => b.ctime.getTime() - a.ctime.getTime()); // Más nuevos primero

    if (files.length > RETENTION_DAYS) {
      const filesToDelete = files.slice(RETENTION_DAYS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        logger.info(`Backup antiguo eliminado (retención de ${RETENTION_DAYS} días)`, { filename: file.name });
      });
    }
  } catch (error) {
    logger.error('Error limpiando backups antiguos', { error: error.message });
  }
};

/**
 * Obtiene la lista de backups
 */
export const getBackupList = () => {
  ensureBackupDirExists();
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          sizeBytes: stats.size,
          sizeFormatted: formatBytes(stats.size),
          createdAt: stats.ctime,
          dbName: f.split('_').pop().replace('.sql.gz', '').replace('.sql', '')
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return files;
  } catch (error) {
    logger.error('Error obteniendo lista de backups', { error: error.message });
    throw error;
  }
};

/**
 * Elimina un backup específico
 */
export const deleteBackup = (filename, adminUserId) => {
  try {
    // Validar filename (prevenir path traversal)
    const sanitizedFilename = path.basename(filename);
    if (!sanitizedFilename.endsWith('.sql.gz') && !sanitizedFilename.endsWith('.sql')) {
      throw new Error('Archivo inválido');
    }

    const filePath = path.join(BACKUP_DIR, sanitizedFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Backup eliminado por administrador`, { filename: sanitizedFilename, adminUserId });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error eliminando backup', { error: error.message, filename });
    throw error;
  }
};

/**
 * Obtiene el estado de los backups (uso de disco, etc)
 */
export const getBackupStatus = () => {
  try {
    const files = getBackupList();
    const totalSizeBytes = files.reduce((acc, file) => acc + file.sizeBytes, 0);
    const lastBackup = files.length > 0 ? files[0] : null;

    return {
      totalBackups: files.length,
      diskUsageBytes: totalSizeBytes,
      diskUsageFormatted: formatBytes(totalSizeBytes),
      lastBackupDate: lastBackup ? lastBackup.createdAt : null,
      backupDirectory: 'Protegido (Externa)'
    };
  } catch (error) {
    logger.error('Error obteniendo estado de backups', { error: error.message });
    throw error;
  }
};

export const getBackupFilePath = (filename) => {
  const sanitizedFilename = path.basename(filename);
  return path.join(BACKUP_DIR, sanitizedFilename);
};

// Utils
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Inicializa el Cron Job de Backups (Todos los días a las 2:00 AM)
 */
export const initBackupCronJob = () => {
  // 0 2 * * * = Todos los días a las 02:00
  cron.schedule('0 2 * * *', async () => {
    logger.info('Ejecutando tarea programada: Backup de Base de Datos');
    try {
      await generateBackup('CRON_SYSTEM');
    } catch (error) {
      logger.error('Fallo en la tarea programada de backup', { error: error.message });
    }
  });
  logger.info('Cron job de backups registrado (02:00 AM)');
};
