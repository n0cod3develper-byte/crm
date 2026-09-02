import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Facturacion/FacturasListPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /<tr[\s\S]*?className="hover:bg-subtle\/30 transition-colors group cursor-pointer"[\s\S]*?onClick=\{\(\) => navigate\(\`\/facturacion\/facturas\/\$\{factura\.id\}\`\)\}[\s\S]*?>[\s\S]*?<td className="px-6 py-4">/;

const newTr = `<tr 
                  key={factura.id} 
                  className={\`transition-all group cursor-pointer \${selectedFactura?.id === factura.id ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-subtle/30'}\`}
                  onClick={() => navigate(\`/facturacion/facturas/\${factura.id}\`)}
                >
                  {tab === 'PREFACTURA' && (
                    <td className="px-5 py-4 text-center" onClick={(e) => toggleSelect(factura, e)}>
                      <div className={\`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto \${
                        selectedFactura?.id === factura.id ? 'bg-accent border-accent text-white' : 'border-color'
                      }\`}>
                        {selectedFactura?.id === factura.id && <CheckCircle2 size={12} />}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">`;

content = content.replace(regex, newTr);
fs.writeFileSync(filePath, content);
console.log("Fixed TR block!");
