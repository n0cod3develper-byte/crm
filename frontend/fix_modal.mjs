import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Facturacion/OtsPendientesPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
`  const confirmCreate = () => {
    if (!nroFactura.trim()) {
      toast.error('El número de factura es obligatorio');
      return;
    }`,
`  const confirmCreate = () => {`
);

content = content.replace(
`                    Número de Factura <span className="text-red-500">*</span>`,
`                    Número de Factura (Opcional)`
);

content = content.replace(
`                disabled={createPrefacturaMutation.isLoading || !nroFactura.trim()}`,
`                disabled={createPrefacturaMutation.isLoading}`
);

fs.writeFileSync(filePath, content);
console.log("OtsPendientesPage updated to make invoice number optional.");
