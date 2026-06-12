import fs from 'fs';
import path from 'path';

const pdfPath = 'c:/Users/Sistemas/CRM/crm/backend/src/utils/remisionPdfGenerator.js';
let content = fs.readFileSync(pdfPath, 'utf8');

// Replace the horarioRows logic
content = content.replace(/\/\/ Se usan los campos principales del servicio en la fila DIURNO[\s\S]*?const totalHorasDesglose =[\s\S]*?\(parseFloat\(rem\.horas_otras\) \|\| 0\);/g, `
  const horarioRows = [
    { label: 'ORDINARIA', horas: rem.horas_ordinarias, valor: rem.valor_hora_ordinaria },
    { label: 'CON RECARGO', horas: rem.horas_recargo, valor: rem.valor_hora_recargo },
  ];

  const totalParcialDesglose =
    ((parseFloat(rem.horas_ordinarias) || 0) * (parseFloat(rem.valor_hora_ordinaria) || 0)) +
    ((parseFloat(rem.horas_recargo) || 0) * (parseFloat(rem.valor_hora_recargo) || 0));

  const totalHorasDesglose =
    (parseFloat(rem.horas_ordinarias) || 0) +
    (parseFloat(rem.horas_recargo) || 0);
`);

// Replace DESCRIPCION SERVICIO table
content = content.replace(/<!-- DESCRIPCIÓN SERVICIO -->[\s\S]*?<\/table>/g, `<!-- DESCRIPCIÓN SERVICIO -->
  <div style="font-weight: bold; margin-bottom: 2px;">DESCRIPCIÓN SERVICIO</div>
  <table style="margin-bottom: 12px;">
    <thead>
      <tr>
        <th style="width:30px">ITEM</th>
        <th style="text-align:left">CÓDIGO / DESCRIPCIÓN</th>
        <th style="width:50px">CANT.</th>
        <th style="width:80px">VR. UNIT.</th>
        <th style="width:80px">SUBTOTAL</th>
      </tr>
    </thead>
    <tbody>
      \${(rem.items && rem.items.length > 0) ? rem.items.map((item, i) => \`
      <tr>
        <td class="td-center">\${i + 1}</td>
        <td>
          <strong>\${item.servicio_codigo || ''}</strong> - \${item.servicio_nombre || ''}
          \${item.descripcion ? \`<br><span style="color:#444;">\${item.descripcion}</span>\` : ''}
        </td>
        <td class="td-center">\${item.cantidad || 1}</td>
        <td class="td-center">\${item.valor_unitario > 0 ? 'CO$ ' + new Intl.NumberFormat('es-CO').format(item.valor_unitario) : ''}</td>
        <td class="td-center">\${(item.cantidad * item.valor_unitario) > 0 ? 'CO$ ' + new Intl.NumberFormat('es-CO').format(item.cantidad * item.valor_unitario) : ''}</td>
      </tr>
      \`).join('') : \`
      <tr>
        <td class="td-center">1</td>
        <td colspan="4"><strong>\${rem.servicio_codigo || ''}</strong><br>\${rem.servicio_nombre || ''}</td>
      </tr>\`}
    </tbody>
  </table>`);

fs.writeFileSync(pdfPath, content);
console.log('Done replacing pdf generator');
