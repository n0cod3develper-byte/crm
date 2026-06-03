import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'frontend', 'src', 'pages');

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      if (content.includes('import { Sidebar }')) {
        // Eliminar importación
        content = content.replace(/import\s+\{\s*Sidebar\s*\}\s+from\s+['"].*?['"];?\r?\n?/g, '');
        changed = true;
      }
      
      if (content.includes('<Sidebar />')) {
        // Eliminar tag
        content = content.replace(/<Sidebar\s*\/>\s*\r?\n?/g, '');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

traverse(pagesDir);
console.log('Done cleaning sidebars');
