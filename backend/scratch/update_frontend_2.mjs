import fs from 'fs';
import path from 'path';

const formPath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Servicios/RemisionFormPage.jsx';
let content = fs.readFileSync(formPath, 'utf8');

// 1. Remove operario_id requirement from validation
content = content.replace(/\|\| \(!isEditing && !form\.operario_id\)/g, '');
content = content.replace(/<label style=\{label\}>Operario Inicial \*(<\/label>)/g, '<label style={label}>Operario Inicial$1');
content = content.replace(/<select name="operario_id" className="input" style=\{\{ width: '100%' \}\} value=\{form\.operario_id\} onChange=\{handleChange\} required>/g, '<select name="operario_id" className="input" style={{ width: \'100%\' }} value={form.operario_id} onChange={handleChange}>');

// 2. Add aplica_iva to handleAddItem
content = content.replace(/items: \[\.\.\.prev\.items, \{ catalogo_servicio_id: '', descripcion: '', cantidad: 1, valor_unitario: 0 \} \]/g, 'items: [...prev.items, { catalogo_servicio_id: \'\', descripcion: \'\', cantidad: 1, valor_unitario: 0, aplica_iva: false }]');

// 3. Update the table headers and body to include IVA checkbox
content = content.replace(/<th style=\{\{ width: '25%' \}\}>Descripción \(Opcional\)<\/th>\s*<th style=\{\{ width: '12%' \}\}>Cantidad<\/th>\s*<th style=\{\{ width: '15%' \}\}>Valor Unitario<\/th>\s*<th style=\{\{ width: '10%' \}\}>Subtotal<\/th>/g, `<th style={{ width: '20%' }}>Descripción (Opcional)</th>
                      <th style={{ width: '10%' }}>Cantidad</th>
                      <th style={{ width: '15%' }}>Valor Unitario</th>
                      <th style={{ width: '5%' }}>+IVA</th>
                      <th style={{ width: '15%' }}>Subtotal</th>`);

content = content.replace(/<td style=\{\{ padding: '0\.5rem', fontWeight: 600 \}\}>\s*\{formatCOP\(parseFloat\(item\.cantidad \|\| 0\) \* parseFloat\(item\.valor_unitario \|\| 0\)\)\}\s*<\/td>/g, `<td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!item.aplica_iva} onChange={e => handleItemChange(i, 'aplica_iva', e.target.checked)} disabled={isReadOnly} style={{ width: 16, height: 16, accentColor: 'var(--clr-primary-500)', cursor: 'pointer' }} />
                         </td>
                         <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                            {formatCOP(Math.round(parseFloat(item.cantidad || 0) * parseFloat(item.valor_unitario || 0)))}
                         </td>`);

// 4. Recalculate Totals (IVA per item, Subtotal rounding)
content = content.replace(/const itemsTotal = \(form\.items \|\| \[\]\)\.reduce\(\(acc, item\) => acc \+ \(parseFloat\(item\.cantidad \|\| 0\) \* parseFloat\(item\.valor_unitario \|\| 0\)\), 0\);/g, `const itemsTotal = (form.items || []).reduce((acc, item) => acc + Math.round(parseFloat(item.cantidad || 0) * parseFloat(item.valor_unitario || 0)), 0);
    const ivaCalculado = (form.items || []).reduce((acc, item) => {
      if (item.aplica_iva) {
        return acc + Math.round((parseFloat(item.cantidad || 0) * parseFloat(item.valor_unitario || 0)) * 0.19);
      }
      return acc;
    }, 0);`);

content = content.replace(/const iva = form\.aplica_iva \? Math\.round\(bruto \* 0\.19\) : 0;/g, 'const iva = ivaCalculado;');
content = content.replace(/iva_pct: form\.aplica_iva \? 19 : 0,/g, 'iva_pct: 19,');

// 5. Hide Global IVA checkbox in the totals section
content = content.replace(/<div>\s*<label style=\{label\}>IVA<\/label>[\s\S]*?<\/label>\s*<br \/>\s*\}\)\}\s*<\/div>\s*<\/div>\s*<div>/g, `<div>`);
// Wait, the regex above for the global IVA block might be wrong because I already replaced it in the previous step.
// Let's use string replace for the exact block I put there.
const globalIvaBlock = `<div>
                    <label style={label}>IVA</label>
                    {isReadOnly ? (
                      <span style={{ display: 'flex', alignItems: 'center', height: '36px', fontWeight: 600, fontSize: 'var(--text-sm)', color: form.aplica_iva ? 'var(--clr-primary-500)' : 'var(--text-muted)' }}>
                        {form.aplica_iva ? '✔ Aplica IVA (19%)' : '✘ Sin IVA'}
                      </span>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', height: '36px', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          id="aplica_iva"
                          name="aplica_iva"
                          checked={!!form.aplica_iva}
                          onChange={(e) => setForm(prev => ({ ...prev, aplica_iva: e.target.checked }))}
                          style={{ width: 16, height: 16, accentColor: 'var(--clr-primary-500)', cursor: 'pointer' }}
                        />
                        Aplicar IVA (19%)
                      </label>
                    )}
                  </div>`;
content = content.replace(globalIvaBlock, `<div>{/* IVA per item now */}</div>`);

content = content.replace(/<span style=\{\{ \.\.\.label, display: 'block' \}\}>IVA \{form\.aplica_iva \? '\(19%\)' : ''\}<\/span>/g, `<span style={{ ...label, display: 'block' }}>IVA (19%)</span>`);
content = content.replace(/<span style=\{\{ fontWeight: 700, color: form\.aplica_iva \? 'inherit' : 'var\(--text-muted\)' \}\}>\{form\.aplica_iva \? formatCOP\(form\.iva_valor\) : '—'\}<\/span>/g, `<span style={{ fontWeight: 700 }}>{formatCOP(form.iva_valor)}</span>`);


// 6. Hide "Tiempos del Servicio" if no operator service
content = content.replace(/\{\/\* — Tiempos del Servicio \(Primer Operario\) — \*\/\}/g, `
          {/* Variable para mostrar u ocultar tiempos */}
          {(() => {
            const hasOperarioService = (form.items || []).some(item => {
              const name = catalogoMap[item.catalogo_servicio_id]?.nombre?.toUpperCase() || '';
              return name.includes('OPERARIO');
            });
            if (!hasOperarioService) return null;
            return (
              <>
          {/* — Tiempos del Servicio (Primer Operario) — */}`);

content = content.replace(/\{\/\* — Totales Finales — \*\/\}/g, `
              </>
            );
          })()}

          {/* — Totales Finales — */}`);

fs.writeFileSync(formPath, content);
console.log('Done replacing RemisionFormPage.jsx with requested changes');
