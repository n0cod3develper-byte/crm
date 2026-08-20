import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Facturacion/FacturaDetailPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix titleNumbers
content = content.replace(
`  const titleNumbers = fact.ots?.length > 0 
    ? fact.ots.map(ot => ot.ot_consecutivo).join(', ') 
    : fact.consecutivo_interno;`,
`  const titleNumbers = fact.numero_factura || fact.consecutivo_interno;`
);

// Fix Emitida el timezone
content = content.replace(
`Emitida el {new Date(fact.fecha_prefactura).toLocaleDateString()}`,
`Emitida el {fact.fecha_prefactura ? new Date(fact.fecha_prefactura + 'T12:00:00Z').toLocaleDateString() : '—'}`
);

// Fix Vencimiento timezone and null
content = content.replace(
`<p className="font-bold">{new Date(fact.fecha_vencimiento).toLocaleDateString()}</p>`,
`<p className="font-bold">{fact.fecha_vencimiento ? new Date(fact.fecha_vencimiento + 'T12:00:00Z').toLocaleDateString() : '—'}</p>`
);

// Add summary table to Confirm modal
const modalTextToReplace = `              <div className="bg-accent/10 p-4 rounded-2xl border border-accent/20">
                <p className="text-sm text-center text-accent font-semibold">
                  Al confirmar, las OTs asociadas cambiarán a estado <strong>FACTURADA</strong> y no podrán ser editadas.
                </p>
              </div>`;

const modalTable = `              <div className="bg-subtle/40 rounded-2xl border border-color overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/50 text-xs uppercase text-muted sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Documento</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-color">
                    {fact.remisiones?.map(r => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 font-bold">{r.numero_remision}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(r.total_rem)}</td>
                      </tr>
                    ))}
                    {fact.ots?.map(o => (
                      <tr key={o.id}>
                        <td className="px-4 py-2 font-bold">{o.ot_consecutivo}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(o.total_ot)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-subtle/50 sticky bottom-0 border-t border-color">
                    <tr>
                      <td className="px-4 py-2 text-right font-bold text-muted">Total a Confirmar:</td>
                      <td className="px-4 py-2 text-right font-bold text-accent">{formatCurrency(fact.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>`;

content = content.replace(modalTextToReplace, modalTable);

fs.writeFileSync(filePath, content);
console.log("Updated FacturaDetailPage UI fixes.");
