const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'frontend/src/pages');

function findFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, allFiles);
    } else if (file.endsWith('.jsx')) {
      allFiles.push(filePath);
    }
  }
  return allFiles;
}

const files = findFiles(PAGES_DIR);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<Topbar')) {
    console.log(`Fixing ${file}...`);
    
    // Fix title if it's not a string or braced
    content = content.replace(/title=([^"{].*?)(?=\n| subtitle=)/g, (match, p1) => {
      const val = p1.trim();
      if (val.startsWith('<')) return `title={<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>${val}</div>}`;
      return `title="${val}"`;
    });

    // Fix subtitle if it's not a string or braced
    content = content.replace(/subtitle=([^"{].*?)(?=\n| rightContent=)/g, (match, p1) => {
        const val = p1.trim();
        // Check if it's something like {count} items
        if (val.includes('{')) {
            // Replace {count} text with `{$1} text`
            const fixed = val.replace(/{(.*?)}/g, '${$1}');
            return `subtitle={\`${fixed}\`}`;
        }
        return `subtitle="${val}"`;
    });

    // Clean up empty rightContent or nulls
    content = content.replace(/rightContent={null}/g, '');
    content = content.replace(/rightContent={\s*<>\s*(.*?)\s*<\/>\s*}/gs, 'rightContent={$1}');

    fs.writeFileSync(file, content);
  }
});
