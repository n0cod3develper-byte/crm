import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedPath = null;

/**
 * Busca recursivamente un archivo llamado 'chrome' dentro de un directorio.
 * No ejecuta procesos externos — usa readdirSync para evitar overhead y problemas de quoting.
 */
function findChromeInDir(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findChromeInDir(fullPath);
        if (found) return found;
      } else if (entry.name === 'chrome' && entry.isFile()) {
        return fullPath;
      }
    }
  } catch {}
  return null;
}

/**
 * Encuentra el ejecutable de Chrome/Chromium.
 * Busca en: PUPPETEER_EXECUTABLE_PATH → ~/.cache/puppeteer → node_modules/.cache/puppeteer
 * El resultado se cachea después de la primera búsqueda.
 */
export function findChromePath() {
  if (cachedPath) return cachedPath;

  // 1. Variable de entorno
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      cachedPath = process.env.PUPPETEER_EXECUTABLE_PATH;
      return cachedPath;
    }
  }

  // 2. Caché de Puppeteer (~/.cache/puppeteer)
  const homeCache = join(process.env.HOME || '/root', '.cache', 'puppeteer');
  if (existsSync(homeCache)) {
    const found = findChromeInDir(homeCache);
    if (found) {
      cachedPath = found;
      return cachedPath;
    }
  }

  // 3. node_modules/.cache/puppeteer (alternativa)
  const localCache = join(__dirname, '..', '..', 'node_modules', '.cache', 'puppeteer');
  if (existsSync(localCache)) {
    const found = findChromeInDir(localCache);
    if (found) {
      cachedPath = found;
      return cachedPath;
    }
  }

  return null;
}
