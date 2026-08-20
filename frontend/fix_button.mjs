import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Facturacion/OtsPendientesPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
`                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    Confirmar Factura
                  </>`,
`                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    {nroFactura.trim() ? 'Registrar Factura Final' : 'Generar Prefactura'}
                  </>`
);

fs.writeFileSync(filePath, content);
console.log("Button text made dynamic.");
