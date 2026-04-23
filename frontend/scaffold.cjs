const fs = require('fs');
const dirs = ['src/pages/Proveedores', 'src/pages/Compras'];
dirs.forEach(d => fs.mkdirSync(d, {recursive: true}));
const pages = {
  'src/pages/Proveedores/ProveedoresListPage.jsx': 'ProveedoresListPage',
  'src/pages/Proveedores/ProveedorFormPage.jsx': 'ProveedorFormPage',
  'src/pages/Proveedores/ProveedorFichaPage.jsx': 'ProveedorFichaPage',
  'src/pages/Compras/DashboardComprasPage.jsx': 'DashboardComprasPage',
  'src/pages/Compras/SolicitudesListPage.jsx': 'SolicitudesListPage',
  'src/pages/Compras/SolicitudFormPage.jsx': 'SolicitudFormPage',
  'src/pages/Compras/ComparacionCotizacionesPage.jsx': 'ComparacionCotizacionesPage',
  'src/pages/Compras/OrdenesCompraPage.jsx': 'OrdenesCompraPage',
  'src/pages/Compras/OrdenCompraFormPage.jsx': 'OrdenCompraFormPage',
  'src/pages/Compras/AprobacionesPage.jsx': 'AprobacionesPage',
  'src/pages/Compras/RecepcionMercanciaPage.jsx': 'RecepcionMercanciaPage'
};
Object.keys(pages).forEach(f => {
   const comp = pages[f];
   if (!fs.existsSync(f)) {
      const code = `import React from 'react';

export const ${comp} = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">${comp}</h1>
      <p>Vista en construcción...</p>
    </div>
  );
};
`;
      fs.writeFileSync(f, code);
   }
});
