import fs from 'fs';
import path from 'path';

const formPath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Servicios/RemisionFormPage.jsx';
let content = fs.readFileSync(formPath, 'utf8');

// 1. Modificar EMPTY state
content = content.replace(/const EMPTY = \{[\s\S]*?estado: 'BORRADOR',\n\};/g, `const EMPTY = {
  fecha_servicio: new Date().toISOString().split('T')[0],
  hora_acordada: '',
  forma_pago: 'Contado',
  company_id: '', equipo_id: '', operario_id: '', operario_2_id: '',
  solicitado_por: '', solicitado_por_id: '', direccion_servicio: '', numero_maquina: '',
  hora_salida_cargar: '', hora_llegada_cliente: '', hora_salida_cliente: '', hora_llegada_cargar: '',
  segundo_fecha_acordada: '', segundo_hora_salida_cargar: '', segundo_hora_llegada_cliente: '', segundo_hora_salida_cliente: '', segundo_hora_llegada_cargar: '', segundo_horometro_salida: '', segundo_horometro_regreso: '',
  horometro_salida: '', horometro_regreso: '',
  items: [],
  horas_ordinarias: 0, valor_hora_ordinaria: 0,
  horas_recargo: 0, valor_hora_recargo: 0,
  total_bruto: 0, iva_pct: 0, aplica_iva: false, iva_valor: 0, descuentos: 0, total_neto: 0,
  observaciones: '',
  estado: 'BORRADOR',
};`);

// 2. Modificar funciones de cálculo de horas y lógica
content = content.replace(/function calcularHoras\(salida, regreso\) \{[\s\S]*?\}\n/g, `function calcularHoras(salida, regreso) {
  const s = parseFloat(salida);
  const r = parseFloat(regreso);
  if (isNaN(s) || isNaN(r) || r <= s) return null;
  const diff = r - s;
  return Math.max(1, Math.round(diff * 100) / 100);
}

function calcularDesgloseHoras(salidaStr, llegadaStr) {
  if (!salidaStr || !llegadaStr) return { ordinarias: 0, recargo: 0, total: 0 };
  const ts = (t) => t.length > 5 ? t.substring(0, 5) : t;
  const s = new Date(\`1970-01-01T\${ts(salidaStr)}:00\`);
  const l = new Date(\`1970-01-01T\${ts(llegadaStr)}:00\`);
  if (isNaN(s.getTime()) || isNaN(l.getTime())) return { ordinarias: 0, recargo: 0, total: 0 };
  if (l < s) l.setDate(l.getDate() + 1);

  let ordinarias = 0;
  let recargo = 0;
  let current = new Date(s);
  while (current < l) {
    const hora = current.getHours();
    if (hora >= 7 && hora < 17) ordinarias++;
    else recargo++;
    current.setMinutes(current.getMinutes() + 1);
  }

  let hOrd = Math.round((ordinarias / 60) * 100) / 100;
  let hRec = Math.round((recargo / 60) * 100) / 100;
  if ((hOrd + hRec) < 1 && (hOrd + hRec) > 0) {
    if (hOrd >= hRec) hOrd = 1; else hRec = 1;
  }
  return { ordinarias: hOrd, recargo: hRec, total: hOrd + hRec };
}
`);

// 3. Quitar useEffect del valor_hora y fest_dia que dependian de un solo servicio
content = content.replace(/\/\/ ─── Al cambiar servicio: autocompletar valor_hora[\s\S]*?\/\/ ─── Auto-calcular valor_hora_fest_dia/g, '// ─── Auto-calcular valor_hora_fest_dia');
content = content.replace(/\/\/ ─── Auto-calcular valor_hora_fest_dia al 125% del valor_hora ──[\s\S]*?\/\/ ─── Auto-calcular Estado/g, '// ─── Auto-calcular Estado');

// 4. Update the hasObligatorios check
content = content.replace(/const hasObligatorios = form\.company_id && form\.catalogo_servicio_id && form\.equipo_id && form\.fecha_servicio;/g, 'const hasObligatorios = form.company_id && form.items.length > 0 && form.equipo_id && form.fecha_servicio;');
content = content.replace(/form\.company_id, form\.catalogo_servicio_id, form\.equipo_id, form\.fecha_servicio,/g, 'form.company_id, form.items, form.equipo_id, form.fecha_servicio,');

// 5. Update form submission check
content = content.replace(/if \(!form\.company_id \|\| !form\.catalogo_servicio_id \|\| !form\.equipo_id \|\| !form\.fecha_servicio \|\| \(!isEditing && !form\.operario_id\)\) \{/g, 'if (!form.company_id || form.items.length === 0 || !form.equipo_id || !form.fecha_servicio || (!isEditing && !form.operario_id)) {');

// 6. Rewrite the handle calculation for times. This is the big React.useEffect(() => { if (horasManual) return; ...
content = content.replace(/\/\/ ─── Auto-calcular horas por tiempos \(Ambos operarios\) ─────────────────────[\s\S]*?\/\/ ─── Auto-calcular totales ───────────────────────────────────/g, `// ─── Auto-calcular desglose de horas por tiempos ─────────────────────
  React.useEffect(() => {
    if (horasManual) return;
    
    let hOrd = 0, hRec = 0;

    // Operario 1
    if (form.hora_salida_cargar && form.hora_llegada_cargar) {
      const { ordinarias, recargo } = calcularDesgloseHoras(form.hora_salida_cargar, form.hora_llegada_cargar);
      hOrd += ordinarias;
      hRec += recargo;
    } else if (form.horometro_salida && form.horometro_regreso) {
      const diff = Math.max(0, parseFloat(form.horometro_regreso) - parseFloat(form.horometro_salida));
      hOrd += diff; // Asumimos ordinarias por defecto si es por horómetro
    }

    // Operario 2
    if (form.operario_2_id && form.segundo_hora_salida_cargar && form.segundo_hora_llegada_cargar) {
      const { ordinarias, recargo } = calcularDesgloseHoras(form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar);
      hOrd += ordinarias;
      hRec += recargo;
    } else if (form.operario_2_id && form.segundo_horometro_salida && form.segundo_horometro_regreso) {
      const diff = Math.max(0, parseFloat(form.segundo_horometro_regreso) - parseFloat(form.segundo_horometro_salida));
      hOrd += diff;
    }

    hOrd = Math.round(hOrd * 100) / 100;
    hRec = Math.round(hRec * 100) / 100;
    
    // Si no hay ítems no aplicamos
    if (form.items && form.items.length > 0) {
      setForm(prev => {
        const newItems = [...prev.items];
        // Solo autocompletamos la cantidad del primer item si no ha sido modificado manualmente
        // Opcional: Podríamos dejar que el usuario lo digite. 
        // Según los requerimientos: "calcula automaticamente la cantidad por medio de hora llegada - hora salida"
        // Actualizamos las horas ordinarias y recargo globales de la remisión
        return { 
          ...prev, 
          horas_ordinarias: hOrd,
          horas_recargo: hRec
        };
      });
    } else {
      setForm(prev => ({ ...prev, horas_ordinarias: hOrd, horas_recargo: hRec }));
    }
  }, [
    form.hora_salida_cargar, form.hora_llegada_cargar,
    form.horometro_salida, form.horometro_regreso,
    form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar,
    form.segundo_horometro_salida, form.segundo_horometro_regreso,
    form.operario_2_id, horasManual
  ]);

  // ─── Auto-calcular totales ───────────────────────────────────
`);

content = content.replace(/\/\/ ─── Auto-calcular totales ───────────────────────────────────[\s\S]*?\/\/ ─── Mutation/g, `// ─── Auto-calcular totales ───────────────────────────────────
  React.useEffect(() => {
    // Total de ítems
    const itemsTotal = (form.items || []).reduce((acc, item) => acc + (parseFloat(item.cantidad || 0) * parseFloat(item.valor_unitario || 0)), 0);
    
    // Si usamos el sistema de "horas_ordinarias" y "horas_recargo", sumamos el recargo. 
    // Valor ordinario = lo calculamos usando el primer item de servicio? 
    // El requerimiento dice: "la cantidad de horas no se digita a mano se hace automaticamente pero que deje cambiarlo"
    // "si tiene recargo recuerda mostrarlo en la remision ... separado por tipo de horas, ordinaria o con recargo"
    // Si la remision tiene un precio de hora ordinaria y recargo:
    const valorBase = form.items[0] ? parseFloat(form.items[0].valor_unitario || 0) : 0;
    const valorOrdinario = parseFloat(form.horas_ordinarias || 0) * valorBase;
    const valorRecargo = parseFloat(form.horas_recargo || 0) * (valorBase * 1.25);
    
    // El bruto total es la suma de items adicionales + el cálculo de horas si es con operario.
    // Como los ítems ahora son independientes, el bruto es la suma de los subtotales de ítems. 
    // PERO, si el ítem tiene las horas de la remisión, no podemos cobrar doble.
    // Solución simplificada basada en el requerimiento "que se vayan sumando en el total remision pero separados por los items":
    const bruto = itemsTotal;
    
    const iva = form.aplica_iva ? Math.round(bruto * 0.19) : 0;
    const neto = bruto + iva - parseFloat(form.descuentos || 0) + totalLiquidacion;
    setForm(prev => ({
      ...prev,
      valor_hora_ordinaria: valorBase,
      valor_hora_recargo: valorBase * 1.25,
      total_bruto: Math.round(bruto),
      iva_pct: form.aplica_iva ? 19 : 0,
      iva_valor: iva,
      total_neto: Math.round(neto),
    }));
  }, [form.items, form.horas_ordinarias, form.horas_recargo, form.aplica_iva, form.descuentos, totalLiquidacion]);

  // ─── Lógica para manejar Ítems ───────────────────────────────
  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { catalogo_servicio_id: '', descripcion: '', cantidad: 1, valor_unitario: 0 }]
    }));
  };

  const handleRemoveItem = (index) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index][field] = value;
      // Auto-completar precio base si selecciona un servicio del catálogo
      if (field === 'catalogo_servicio_id' && catalogoMap[value]) {
        newItems[index].valor_unitario = catalogoMap[value].precio_base || 0;
        // Si es el primer item y calculamos horas globales, le asignamos las horas ordinarias + recargo
        if (index === 0) {
           newItems[index].cantidad = (parseFloat(prev.horas_ordinarias || 0) + parseFloat(prev.horas_recargo || 0)) || 1;
        }
      }
      return { ...prev, items: newItems };
    });
  };

  // ─── Mutation`);

// 7. Remove the "Servicio y Equipo" single inputs and replace with Items Table
content = content.replace(/\{\/\* — Servicio y Equipo — \*\/\}([\s\S]*?)\{\/\* — Tiempos del Servicio \(Primer Operario\) — \*\/\}/g, `{/* — Servicio y Equipo — */}
          <p style={section}>Equipos y Operarios</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={label}>Equipo *</label>
              {isReadOnly ? (
                <input {...inputProps('equipo_id')} value={\`\${existingData?.equipo_marca} \${existingData?.equipo_modelo} — \${existingData?.equipo_serial}\`} />
              ) : (
                <select name="equipo_id" className="input" style={{ width: '100%' }} value={form.equipo_id} onChange={handleChange} required>
                  <option value="">Seleccionar equipo...</option>
                  {equiposFiltrados.map(e => <option key={e.id} value={e.id}>{e.marca} - {e.serie || '—'}</option>)}
                </select>
              )}
            </div>
            <div>
              <label style={label}>No. Máquina</label>
              <input placeholder="Ej: 73" {...inputProps('numero_maquina')} />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={label}>Operario Inicial *</label>
                {isReadOnly ? (
                  <input className="input" style={{ width: '100%' }} disabled value={existingData?.operarios?.[0]?.full_name || '—'} />
                ) : (
                  <select name="operario_id" className="input" style={{ width: '100%' }} value={form.operario_id} onChange={handleChange} required>
                    <option value="">Seleccionar operario...</option>
                    {operariosDisp.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={label}>Segundo Operario (Opcional)</label>
                {isReadOnly ? (
                  <input className="input" style={{ width: '100%' }} disabled value={existingData?.operarios?.[1]?.full_name || '—'} />
                ) : (
                  <select name="operario_2_id" className="input" style={{ width: '100%' }} value={form.operario_2_id || ''} onChange={handleChange}>
                    <option value="">Seleccionar segundo operario...</option>
                    {operariosDisp.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
             <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, border: 'none' }}>Ítems de Servicio</p>
             {!isReadOnly && (
               <button type="button" onClick={handleAddItem} className="btn btn--primary btn--sm" style={{ padding: '4px 8px' }}>
                 <Plus size={14} /> Agregar Ítem
               </button>
             )}
          </div>
          
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
             <table className="table" style={{ minWidth: '800px', margin: 0 }}>
                <thead>
                   <tr>
                      <th style={{ width: '35%' }}>Servicio / Catálogo *</th>
                      <th style={{ width: '25%' }}>Descripción (Opcional)</th>
                      <th style={{ width: '12%' }}>Cantidad</th>
                      <th style={{ width: '15%' }}>Valor Unitario</th>
                      <th style={{ width: '10%' }}>Subtotal</th>
                      {!isReadOnly && <th style={{ width: '3%' }}></th>}
                   </tr>
                </thead>
                <tbody>
                   {(form.items || []).map((item, i) => (
                      <tr key={i}>
                         <td style={{ padding: '0.5rem' }}>
                            {isReadOnly ? (
                               <input className="input" disabled value={\`[\${catalogoMap[item.catalogo_servicio_id]?.codigo || ''}] \${catalogoMap[item.catalogo_servicio_id]?.nombre || ''}\`} style={{ width: '100%' }}/>
                            ) : (
                               <select className="input" required value={item.catalogo_servicio_id} onChange={e => handleItemChange(i, 'catalogo_servicio_id', e.target.value)} style={{ width: '100%' }}>
                                  <option value="">Seleccionar...</option>
                                  {catalogoItems.map(s => <option key={s.id} value={s.id}>[{s.codigo}] {s.nombre}</option>)}
                               </select>
                            )}
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                            <input className="input" value={item.descripcion || ''} onChange={e => handleItemChange(i, 'descripcion', e.target.value)} disabled={isReadOnly} style={{ width: '100%' }} placeholder="Nota..." />
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                            <input className="input" type="number" step="0.01" value={item.cantidad || ''} onChange={e => handleItemChange(i, 'cantidad', e.target.value)} disabled={isReadOnly} style={{ width: '100%' }} min="0"/>
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                            <input className="input" type="number" step="0.01" value={item.valor_unitario || ''} onChange={e => handleItemChange(i, 'valor_unitario', e.target.value)} disabled={isReadOnly} style={{ width: '100%' }} min="0"/>
                         </td>
                         <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                            {formatCOP(parseFloat(item.cantidad || 0) * parseFloat(item.valor_unitario || 0))}
                         </td>
                         {!isReadOnly && (
                            <td style={{ padding: '0.5rem' }}>
                               <button type="button" onClick={() => handleRemoveItem(i)} className="btn btn--danger btn--sm" style={{ padding: '4px' }}>X</button>
                            </td>
                         )}
                      </tr>
                   ))}
                   {(form.items || []).length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No hay ítems agregados. Haga clic en "Agregar Ítem".</td></tr>
                   )}
                </tbody>
             </table>
          </div>

          {/* — Tiempos del Servicio (Primer Operario) — */}`);

// 8. Remove the old "Descripción del Servicio — Valores" block completely as it's replaced by the totals block at the bottom
content = content.replace(/\{\/\* — Descripción del Servicio — \*\/\}([\s\S]*?)\{\/\* — Observaciones — \*\/\}/g, `{/* — Totales Finales — */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
             <div>
                <p style={{...section, margin: 0}}>Desglose de Horas Calculadas</p>
                <table className="table" style={{ margin: '0.5rem 0' }}>
                   <thead><tr><th>Horario</th><th>Horas</th><th>Valor Hora</th><th>Total</th></tr></thead>
                   <tbody>
                      <tr>
                         <td><strong>ORDINARIA</strong></td>
                         <td>{form.horas_ordinarias || 0}</td>
                         <td>{formatCOP(form.valor_hora_ordinaria)}</td>
                         <td>{formatCOP(parseFloat(form.horas_ordinarias || 0) * parseFloat(form.valor_hora_ordinaria || 0))}</td>
                      </tr>
                      <tr>
                         <td><strong>CON RECARGO</strong> (125%)</td>
                         <td>{form.horas_recargo || 0}</td>
                         <td>{formatCOP(form.valor_hora_recargo)}</td>
                         <td>{formatCOP(parseFloat(form.horas_recargo || 0) * parseFloat(form.valor_hora_recargo || 0))}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
             <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
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
                  </div>
                  <div>
                    <label style={label}>Descuentos (COP)</label>
                    <input type="number" min={0} {...inputProps('descuentos')} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>Subtotal Ítems</span><span style={{ fontWeight: 700 }}>{formatCOP(form.total_bruto)}</span></div>
                  <div style={{ flex: 1 }}>
                    <span style={{ ...label, display: 'block' }}>IVA {form.aplica_iva ? '(19%)' : ''}</span>
                    <span style={{ fontWeight: 700, color: form.aplica_iva ? 'inherit' : 'var(--text-muted)' }}>{form.aplica_iva ? formatCOP(form.iva_valor) : '—'}</span>
                  </div>
                  <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>TOTAL NETO</span><span style={{ fontWeight: 800, color: 'var(--clr-primary-500)', fontSize: '16px' }}>{formatCOP(form.total_neto)}</span></div>
                </div>
             </div>
          </div>

          {/* — Observaciones — */}`);

fs.writeFileSync(formPath, content);
console.log('Done replacing RemisionFormPage.jsx');
