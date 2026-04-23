const fs = require('fs');

const files = [
  'src/pages/Mantenimiento/PMAdminPage.jsx',
  'src/pages/Mantenimiento/OTFormPage.jsx',
  'src/pages/Mantenimiento/OTDetailPage.jsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/\\`/g, '`').replace(/\\\$/g, '$');
  fs.writeFileSync(f, c);
  console.log('Fixed ' + f);
});
