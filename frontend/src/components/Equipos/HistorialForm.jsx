import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, X } from 'lucide-react';
import api from '../../lib/api';

const TIPOS_MANT = [
  { value: 'correctivo',      label: 'Correctivo' },
  { value: 'preventivo_250h', label: 'Preventivo 250h' },
  { value: 'preventivo_500h', label: 'Preventivo 500h' },
  { value: 'preventivo_1000h',label: 'Preventivo 1000h' },
  { value: 'inspeccion',      label: 'Inspección' },
  { value: 'otro',            label: 'Otro' },
];
const CRITICIDADES = ['leve','moderado','critico'];
const ESTADOS_CIERRE = ['operativo','operativo_con_restricciones','en_espera_repuestos','fuera_de_servicio'];
const ESTADOS_RETIRADO = ['desgastado','dañado','roto','funcional'];
const PROCEDENCIAS = ['nuevo','reacondicionado','reutilizado'];

const lbl = { fontSize:'var(--text-xs)', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:'0.3rem' };
const secH = {
  fontSize:'var(--text-xs)', fontWeight:700, color:'var(--text-muted)',
  textTransform:'uppercase', letterSpacing:'0.07em',
  display:'flex', alignItems:'center', justifyContent:'space-between',
  padding:'0.75rem 1rem', cursor:'pointer', userSelect:'none',
  background:'var(--bg-elevated)', borderRadius:'var(--radius-md)',
  border:'1px solid var(--border-color)',
};

function Section({ title, open, onToggle, children }) {
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <div style={secH} onClick={onToggle}>
        <span>{title}</span>
        {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </div>
      {open && <div style={{ padding:'1rem', display:'flex', flexDirection:'column', gap:'0.875rem' }}>{children}</div>}
    </div>
  );
}

const EMPTY_REPUESTO = {
  retirado_nombre:'', retirado_codigo:'', retirado_numero_serie:'', retirado_motivo:'', retirado_estado:'',
  instalado_nombre:'', instalado_codigo:'', instalado_numero_serie:'', instalado_procedencia:'', instalado_garantia_hasta:'', instalado_costo_unitario:'',
};

const EMPTY_TRABAJO = { fecha_hora: '', descripcion: '' };

function RepuestoRow({ rep, idx, onChange, onRemove }) {
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'0.875rem', position:'relative' }}>
      <button type="button" onClick={() => onRemove(idx)} style={{ position:'absolute', top:'0.5rem', right:'0.5rem', background:'none', border:'none', cursor:'pointer', color:'var(--clr-danger)' }}>
        <Trash2 size={13}/>
      </button>
      <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.75rem' }}>Repuesto #{idx+1}</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
        {/* Retirado */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <p style={{ fontSize:'10px', fontWeight:600, color:'#f87171', textTransform:'uppercase' }}>↑ Retirado</p>
          {['retirado_nombre','retirado_codigo','retirado_numero_serie','retirado_motivo'].map(f => (
            <div key={f}>
              <label style={lbl}>{f.replace('retirado_','').replace(/_/g,' ')}</label>
              <input className="input" style={{width:'100%'}} value={rep[f]} onChange={e=>onChange(idx,f,e.target.value)} />
            </div>
          ))}
          <div>
            <label style={lbl}>Estado al retirar</label>
            <select className="input" style={{width:'100%'}} value={rep.retirado_estado} onChange={e=>onChange(idx,'retirado_estado',e.target.value)}>
              <option value="">— seleccionar —</option>
              {ESTADOS_RETIRADO.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {/* Instalado */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <p style={{ fontSize:'10px', fontWeight:600, color:'#4ade80', textTransform:'uppercase' }}>↓ Instalado</p>
          {['instalado_nombre','instalado_codigo','instalado_numero_serie'].map(f => (
            <div key={f}>
              <label style={lbl}>{f.replace('instalado_','').replace(/_/g,' ')}</label>
              <input className="input" style={{width:'100%'}} value={rep[f]} onChange={e=>onChange(idx,f,e.target.value)} />
            </div>
          ))}
          <div>
            <label style={lbl}>Procedencia</label>
            <select className="input" style={{width:'100%'}} value={rep.instalado_procedencia} onChange={e=>onChange(idx,'instalado_procedencia',e.target.value)}>
              <option value="">— seleccionar —</option>
              {PROCEDENCIAS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Garantía hasta</label>
            <input type="date" className="input" style={{width:'100%'}} value={rep.instalado_garantia_hasta} onChange={e=>onChange(idx,'instalado_garantia_hasta',e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Costo unitario</label>
            <input type="number" min="0" className="input" style={{width:'100%'}} value={rep.instalado_costo_unitario} onChange={e=>onChange(idx,'instalado_costo_unitario',e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Mapear tipo_mantenimiento de OT (CORRECTIVO / PREVENTIVO) al enum del historial
function mapOTTipoToHistorial(otTipo, frecuenciaHoras) {
  if (!otTipo) return 'correctivo';
  const t = otTipo.toUpperCase();
  if (t === 'CORRECTIVO') return 'correctivo';
  if (t === 'PREVENTIVO') {
    if (frecuenciaHoras >= 1000) return 'preventivo_1000h';
    if (frecuenciaHoras >= 500)  return 'preventivo_500h';
    return 'preventivo_250h';
  }
  return 'otro';
}

export function HistorialForm({ equipoId, historial, initialOtId, onSuccess, onCancel }) {
  const qc = useQueryClient();

  const [open, setOpen] = React.useState({ general:true, fallas:true, trabajos:false, repuestos:false, tiempos:false, cierre:false });
  const toggle = (k) => setOpen(p => ({ ...p, [k]: !p[k] }));

  // Técnicos disponibles
  const { data: tecnicosData } = useQuery({
    queryKey: ['tecnicos-disponibles'],
    queryFn: async () => { const { data } = await api.get('/equipos/tecnicos-disponibles'); return data.data; },
  });

  // OTs disponibles para el equipo
  const { data: otsData } = useQuery({
    queryKey: ['ots-equipo', equipoId],
    queryFn: async () => { const { data } = await api.get('/mantenimiento/ot', { params: { equipo_id: equipoId, limit: 100 } }); return data.data || []; },
  });

  // initialOtId: cuando se invoca desde OTFormPage, pre-selecciona la OT actual
  const defaultOtId = initialOtId || historial?.orden_trabajo_id || '';

  const [form, setForm] = React.useState({
    orden_trabajo_id: defaultOtId,
    tipo_mantenimiento: historial?.tipo_mantenimiento || 'correctivo',
    horometro_al_ingreso: historial?.horometro_al_ingreso || 0,
    tecnicos_ids: historial?.tecnicos?.map(t=>t.empleado_id) || [],
    supervisor_id: historial?.supervisor_id || '',
    supervisor_nombre: historial?.supervisor_nombre || '',  // campo de display
    fallas_encontradas: historial?.fallas_encontradas || '',
    nivel_criticidad: historial?.nivel_criticidad || '',
    causa_raiz: historial?.causa_raiz || '',
    trabajos_realizados: historial?.trabajos_realizados || '',
    observaciones_seguridad: historial?.observaciones_seguridad || '',
    fecha_hora_ingreso_taller: historial?.fecha_hora_ingreso_taller?.slice(0,16) || '',
    fecha_hora_salida_taller: historial?.fecha_hora_salida_taller?.slice(0,16) || '',
    fecha_inicio_bodega: historial?.fecha_inicio_bodega?.slice(0,16) || '',
    fecha_fin_bodega: historial?.fecha_fin_bodega?.slice(0,16) || '',
    estado_equipo_al_cierre: historial?.estado_equipo_al_cierre || '',
    proxima_fecha_mantenimiento: historial?.proxima_fecha_mantenimiento?.slice(0,10) || '',
    costo_total_mantenimiento: historial?.costo_total_mantenimiento || '',
    ot_cerrada: historial?.ot_cerrada || false,
  });

  const [repuestos, setRepuestos] = React.useState(
    historial?.repuestos?.length > 0 ? historial.repuestos.map(r => ({ ...EMPTY_REPUESTO, ...r })) : []
  );
  const [trabajosDetalle, setTrabajosDetalle] = React.useState(
    historial?.trabajos_detalle?.length > 0 ? historial.trabajos_detalle : []
  );
  const [adjuntosFiles, setAdjuntosFiles] = React.useState([]);
  const [otAutoFilled, setOtAutoFilled] = React.useState(false);
  // ID de la OT seleccionada; si viene initialOtId, arranca ya pre-seleccionado
  const [selectedOtId, setSelectedOtId] = React.useState(defaultOtId);

  // ─── Autocompletar desde OT cuando cambia selectedOtId ───
  React.useEffect(() => {
    if (!selectedOtId || !otsData) return;
    const ot = otsData.find(o => o.id === selectedOtId);
    if (!ot) return;

    const tipoHistorial = mapOTTipoToHistorial(ot.tipo_mantenimiento, ot.frecuencia_horas);
    const tecnicosIdsOT = (ot.tecnicos_asignados || []).map(t => t.empleado_id).filter(Boolean);

    setForm(p => ({
      ...p,
      orden_trabajo_id: selectedOtId,
      tipo_mantenimiento: tipoHistorial,
      horometro_al_ingreso: ot.horometro_inicial != null ? ot.horometro_inicial : p.horometro_al_ingreso,
      supervisor_nombre: ot.responsable || p.supervisor_nombre,
      tecnicos_ids: tecnicosIdsOT.length > 0 ? tecnicosIdsOT : p.tecnicos_ids,
      trabajos_realizados: p.trabajos_realizados || ot.detalle_servicio || '',
    }));
    setOtAutoFilled(true);
  }, [selectedOtId, otsData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview tiempos calculados
  const calcTaller = () => {
    if (!form.fecha_hora_ingreso_taller || !form.fecha_hora_salida_taller) return null;
    const min = (new Date(form.fecha_hora_salida_taller) - new Date(form.fecha_hora_ingreso_taller)) / 60000;
    if (min < 0) return null;
    const h = Math.floor(min/60); const m = Math.round(min%60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };
  const calcBodega = () => {
    if (!form.fecha_inicio_bodega || !form.fecha_fin_bodega) return null;
    const min = (new Date(form.fecha_fin_bodega) - new Date(form.fecha_inicio_bodega)) / 60000;
    if (min < 0) return null;
    const h = Math.floor(min/60); const m = Math.round(min%60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const mutation = useMutation({
    mutationFn: (fd) => {
      // No pasar Content-Type manualmente — Axios lo pone con el boundary automáticamente
      if (historial) return api.put(`/equipos/${equipoId}/historial/${historial.id}`, fd);
      return api.post(`/equipos/${equipoId}/historial`, fd);
    },
    onSuccess: () => {
      toast.success(historial ? 'Registro actualizado' : 'Registro creado');
      qc.invalidateQueries({ queryKey: ['equipo-historial', equipoId] });
      onSuccess?.();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'orden_trabajo_id') {
      setOtAutoFilled(false);
      setSelectedOtId(value);
    }
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleTecnico = (id) => {
    setForm(p => ({
      ...p,
      tecnicos_ids: p.tecnicos_ids.includes(id) ? p.tecnicos_ids.filter(t=>t!==id) : [...p.tecnicos_ids, id],
    }));
  };

  const repChange = (idx, field, val) => setRepuestos(p => p.map((r,i) => i===idx ? {...r,[field]:val} : r));
  const repRemove = (idx) => setRepuestos(p => p.filter((_,i) => i!==idx));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.tipo_mantenimiento) { toast.error('Tipo de mantenimiento es obligatorio'); return; }

    const fd = new FormData();
    // No enviar supervisor_nombre (solo es display)
    const { supervisor_nombre, ...formData } = form;
    Object.entries(formData).forEach(([k,v]) => {
      if (Array.isArray(v)) v.forEach(x => fd.append(k, x));
      else if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
    });
    fd.append('repuestos', JSON.stringify(repuestos));
    fd.append('trabajos_detalle', JSON.stringify(trabajosDetalle));
    adjuntosFiles.forEach(f => fd.append('adjuntos', f));
    mutation.mutate(fd);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>

      {/* 1 — Datos generales */}
      <Section title="1. Datos Generales" open={open.general} onToggle={()=>toggle('general')}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <div>
            <label style={lbl}>OT vinculada</label>
            <select name="orden_trabajo_id" className="input" style={{width:'100%'}} value={form.orden_trabajo_id} onChange={handleChange}>
              <option value="">— Sin OT —</option>
              {(otsData||[]).map(o => <option key={o.id} value={o.id}>{o.consecutivo} – {o.tipo_mantenimiento}</option>)}
            </select>
            {otAutoFilled && (
              <span style={{ fontSize:'10px', color:'var(--clr-primary-400)', marginTop:'0.25rem', display:'block' }}>
                ✓ Campos autocompletados desde la OT
              </span>
            )}
          </div>
          <div>
            <label style={lbl}>Tipo de Mantenimiento *</label>
            <select name="tipo_mantenimiento" className="input" style={{width:'100%'}} value={form.tipo_mantenimiento} onChange={handleChange}>
              {TIPOS_MANT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Horómetro al Ingreso (h) *</label>
            <input name="horometro_al_ingreso" type="number" min="0" step="0.1" className="input" style={{width:'100%'}} value={form.horometro_al_ingreso} onChange={handleChange} />
          </div>
          <div>
            <label style={lbl}>Responsable / Supervisor</label>
            <input
              name="supervisor_nombre"
              className="input"
              style={{width:'100%'}}
              value={form.supervisor_nombre}
              onChange={e => setForm(p => ({ ...p, supervisor_nombre: e.target.value }))}
              placeholder="Nombre del responsable"
            />
            <span style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'0.2rem', display:'block' }}>
              {form.supervisor_id ? `ID: ${form.supervisor_id.slice(0,8)}…` : 'Se auto-rellena desde la OT'}
            </span>
          </div>
        </div>
        <div>
          <label style={lbl}>Técnicos asignados</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', marginTop:'0.25rem' }}>
            {(tecnicosData||[]).map(t => (
              <button type="button" key={t.id}
                onClick={() => toggleTecnico(t.id)}
                style={{
                  padding:'0.3rem 0.75rem', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)', fontWeight:600, cursor:'pointer', border:'1px solid',
                  background: form.tecnicos_ids.includes(t.id) ? 'var(--clr-primary-500)' : 'transparent',
                  color: form.tecnicos_ids.includes(t.id) ? '#fff' : 'var(--text-secondary)',
                  borderColor: form.tecnicos_ids.includes(t.id) ? 'var(--clr-primary-500)' : 'var(--border-color)',
                }}
              >
                {t.full_name}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* 2 — Fallas y diagnóstico */}
      <Section title="2. Fallas y Diagnóstico" open={open.fallas} onToggle={()=>toggle('fallas')}>
        <div>
          <label style={lbl}>Fallas encontradas</label>
          <textarea name="fallas_encontradas" className="input" rows={3} style={{width:'100%', resize:'vertical'}} value={form.fallas_encontradas} onChange={handleChange} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <div>
            <label style={lbl}>Nivel de Criticidad</label>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              {CRITICIDADES.map(c => {
                const colors = { leve:'#4ade80', moderado:'#fbbf24', critico:'#f87171' };
                const sel = form.nivel_criticidad === c;
                return (
                  <button type="button" key={c}
                    onClick={() => setForm(p => ({ ...p, nivel_criticidad: c }))}
                    style={{
                      flex:1, padding:'0.4rem 0', borderRadius:'var(--radius-md)', fontSize:'var(--text-xs)', fontWeight:700, cursor:'pointer', border:`1px solid ${colors[c]}`,
                      background: sel ? colors[c] : 'transparent',
                      color: sel ? '#000' : colors[c],
                    }}
                  >
                    {c.charAt(0).toUpperCase()+c.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <label style={lbl}>Causa raíz</label>
          <textarea name="causa_raiz" className="input" rows={2} style={{width:'100%', resize:'vertical'}} value={form.causa_raiz} onChange={handleChange} />
        </div>
      </Section>

      {/* 3 — Trabajos y seguridad */}
      <Section title={`3. Trabajos Realizados (${trabajosDetalle.length})`} open={open.trabajos} onToggle={()=>toggle('trabajos')}>

        {/* Entradas dinámicas por fecha/hora */}
        {trabajosDetalle.length === 0 && (
          <p style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', textAlign:'center', padding:'0.5rem' }}>
            Aún no hay trabajos registrados. Usa el botón para agregar.
          </p>
        )}
        {trabajosDetalle.map((t, i) => (
          <div key={i} style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'0.875rem', position:'relative' }}>
            <button type="button" onClick={() => setTrabajosDetalle(p => p.filter((_,j) => j!==i))}
              style={{ position:'absolute', top:'0.5rem', right:'0.5rem', background:'none', border:'none', cursor:'pointer', color:'var(--clr-danger)' }}>
              <Trash2 size={13}/>
            </button>
            <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.625rem' }}>Trabajo #{i+1}</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:'0.75rem' }}>
              <div>
                <label style={lbl}>Fecha y hora</label>
                <input
                  type="datetime-local"
                  className="input"
                  style={{ width:'100%' }}
                  value={t.fecha_hora}
                  onChange={e => setTrabajosDetalle(p => p.map((x,j) => j===i ? {...x, fecha_hora: e.target.value} : x))}
                />
              </div>
              <div>
                <label style={lbl}>Descripción del trabajo</label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width:'100%', resize:'vertical' }}
                  placeholder="Ej: Cambio de filtros, ajuste de frenos..."
                  value={t.descripcion}
                  onChange={e => setTrabajosDetalle(p => p.map((x,j) => j===i ? {...x, descripcion: e.target.value} : x))}
                />
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf:'flex-start' }}
          onClick={() => setTrabajosDetalle(p => [...p, { ...EMPTY_TRABAJO, fecha_hora: new Date().toISOString().slice(0,16) }])}>
          <Plus size={13}/> Agregar Trabajo
        </button>

        {/* Notas generales de seguridad */}
        <div style={{ borderTop:'1px solid var(--border-color)', paddingTop:'0.875rem', marginTop:'0.25rem' }}>
          <label style={lbl}>Observaciones de seguridad</label>
          <textarea name="observaciones_seguridad" className="input" rows={2} style={{width:'100%', resize:'vertical'}} value={form.observaciones_seguridad} onChange={handleChange} />
        </div>
      </Section>

      {/* 4 — Repuestos */}
      <Section title={`4. Repuestos (${repuestos.length})`} open={open.repuestos} onToggle={()=>toggle('repuestos')}>
        {repuestos.map((r,i) => <RepuestoRow key={i} rep={r} idx={i} onChange={repChange} onRemove={repRemove} />)}
        <button type="button" className="btn btn--ghost btn--sm" style={{alignSelf:'flex-start'}} onClick={()=>setRepuestos(p=>[...p,{...EMPTY_REPUESTO}])}>
          <Plus size={13}/> Agregar Repuesto
        </button>
      </Section>

      {/* 5 — Tiempos */}
      <Section title="5. Tiempos" open={open.tiempos} onToggle={()=>toggle('tiempos')}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <div>
            <label style={lbl}>Ingreso al taller</label>
            <input type="datetime-local" name="fecha_hora_ingreso_taller" className="input" style={{width:'100%'}} value={form.fecha_hora_ingreso_taller} onChange={handleChange} />
          </div>
          <div>
            <label style={lbl}>Salida del taller</label>
            <input type="datetime-local" name="fecha_hora_salida_taller" className="input" style={{width:'100%'}} value={form.fecha_hora_salida_taller} onChange={handleChange} />
          </div>
        </div>
        {calcTaller() && (
          <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'var(--radius-md)', padding:'0.5rem 0.875rem', fontSize:'var(--text-xs)', color:'#4ade80' }}>
            ⏱ Tiempo en taller: <strong>{calcTaller()}</strong>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <div>
            <label style={lbl}>Inicio en bodega</label>
            <input type="datetime-local" name="fecha_inicio_bodega" className="input" style={{width:'100%'}} value={form.fecha_inicio_bodega} onChange={handleChange} />
          </div>
          <div>
            <label style={lbl}>Fin en bodega</label>
            <input type="datetime-local" name="fecha_fin_bodega" className="input" style={{width:'100%'}} value={form.fecha_fin_bodega} onChange={handleChange} />
          </div>
        </div>
        {calcBodega() && (
          <div style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:'var(--radius-md)', padding:'0.5rem 0.875rem', fontSize:'var(--text-xs)', color:'#60a5fa' }}>
            📦 Tiempo en bodega: <strong>{calcBodega()}</strong>
          </div>
        )}
      </Section>

      {/* 6 — Cierre */}
      <Section title="6. Cierre" open={open.cierre} onToggle={()=>toggle('cierre')}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <div>
            <label style={lbl}>Estado del equipo al cierre</label>
            <select name="estado_equipo_al_cierre" className="input" style={{width:'100%'}} value={form.estado_equipo_al_cierre} onChange={handleChange}>
              <option value="">— Seleccionar —</option>
              {ESTADOS_CIERRE.map(e => <option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Próximo mantenimiento</label>
            <input type="date" name="proxima_fecha_mantenimiento" className="input" style={{width:'100%'}} value={form.proxima_fecha_mantenimiento} onChange={handleChange} />
          </div>
          <div>
            <label style={lbl}>Costo total de mantenimiento</label>
            <input type="number" min="0" step="0.01" name="costo_total_mantenimiento" className="input" style={{width:'100%'}} value={form.costo_total_mantenimiento} onChange={handleChange} />
          </div>
        </div>

        {/* Adjuntos */}
        <div>
          <label style={lbl}>Adjuntos (fotos, PDFs, videos)</label>
          <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem', border:'2px dashed var(--border-color)', borderRadius:'var(--radius-md)', cursor:'pointer', fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>
            <Upload size={16}/> Seleccionar archivos (máx. 20MB c/u)
            <input type="file" multiple accept="image/*,video/*,.pdf" style={{display:'none'}} onChange={e => setAdjuntosFiles(p => [...p, ...Array.from(e.target.files)])} />
          </label>
          {adjuntosFiles.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem', marginTop:'0.5rem' }}>
              {adjuntosFiles.map((f,i) => (
                <span key={i} style={{ display:'flex', alignItems:'center', gap:'0.25rem', padding:'0.2rem 0.5rem', background:'var(--bg-elevated)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-full)', fontSize:'10px' }}>
                  {f.name}
                  <button type="button" style={{background:'none',border:'none',cursor:'pointer',color:'var(--clr-danger)',lineHeight:1}} onClick={()=>setAdjuntosFiles(p=>p.filter((_,j)=>j!==i))}>
                    <X size={10}/>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* OT Cerrada */}
        <label style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'var(--radius-md)', cursor:'pointer' }}>
          <input type="checkbox" name="ot_cerrada" checked={form.ot_cerrada} onChange={handleChange} style={{width:16,height:16,cursor:'pointer'}} />
          <span style={{ fontSize:'var(--text-sm)', fontWeight:600, color:'#f87171' }}>
            Cerrar OT — el registro pasará a solo lectura
          </span>
        </label>
      </Section>

      {/* Acciones */}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.75rem', paddingTop:'0.5rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : historial ? 'Guardar Cambios' : 'Crear Registro'}
        </button>
      </div>
    </form>
  );
}
