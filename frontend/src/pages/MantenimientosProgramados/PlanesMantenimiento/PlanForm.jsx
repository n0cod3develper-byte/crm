import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, X } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

export default function PlanForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    nombre: '', descripcion: '', tipo_entidad: 'EQUIPO', equipo_id: '', area_id: '',
    tipo_mantenimiento: 'PREVENTIVO', frecuencia_tipo: 'MESES', frecuencia_valor: '',
    duracion_estimada_horas: '', prioridad: 'MEDIA', responsable_id: '',
    fecha_inicio_vigencia: new Date().toISOString().split('T')[0], fecha_fin_vigencia: '',
    observaciones: '', actividades: [], insumos: [],
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    const loadSelectores = async () => {
      try {
        const [eqRes, usRes, prodRes] = await Promise.all([
          api.get('/equipos', { params: { activo: true } }),
          api.get('/admin/usuarios', { params: { limit: 999, estado: 'ACTIVO' } }),
          api.get('/catalogo', { params: { tipo: 'PRODUCTO', limit: 200 } }),
        ]);
        // También cargar áreas de inventario (hardcoded ya que no hay endpoint específico)
        setAreas([
          { id: 1, nombre: 'Mantenimiento' },
          { id: 2, nombre: 'Sistemas' },
          { id: 3, nombre: 'SST' },
          { id: 4, nombre: 'Locativo' },
        ]);
        setEquipos(eqRes.data?.data || eqRes.data || []);
        setUsuarios(usRes.data?.data || usRes.data?.items || usRes.data || []);
        setProductos(prodRes.data?.items || prodRes.data?.data || []);
      } catch (err) { console.error('Error loading selectors:', err); }
    };
    loadSelectores();
  }, []);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      mpService.getPlan(id).then(res => {
        const data = res.data?.data;
        if (data) {
          setForm({
            nombre: data.nombre || '', descripcion: data.descripcion || '',
            tipo_entidad: data.tipo_entidad || 'EQUIPO',
            equipo_id: data.equipo_id?.toString() || '', area_id: data.area_id?.toString() || '',
            tipo_mantenimiento: data.tipo_mantenimiento || 'PREVENTIVO',
            frecuencia_tipo: data.frecuencia_tipo || 'MESES',
            frecuencia_valor: data.frecuencia_valor?.toString() || '',
            duracion_estimada_horas: data.duracion_estimada_horas?.toString() || '',
            prioridad: data.prioridad || 'MEDIA',
            responsable_id: data.responsable_id?.toString() || '',
            fecha_inicio_vigencia: data.fecha_inicio_vigencia?.split('T')[0] || '',
            fecha_fin_vigencia: data.fecha_fin_vigencia?.split('T')[0] || '',
            observaciones: data.observaciones || '',
            actividades: data.actividades || [], insumos: data.insumos || [],
          });
        }
      }).catch(err => { toast.error('Error al cargar plan'); navigate('..'); }).finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const addActividad = () => setForm(f => ({ ...f, actividades: [...f.actividades, { descripcion: '', obligatoria: true, tiempo_estimado_min: '' }] }));
  const updateActividad = (idx, field, value) => setForm(f => { const acts = [...f.actividades]; acts[idx] = { ...acts[idx], [field]: value }; return { ...f, actividades: acts }; });
  const removeActividad = (idx) => setForm(f => ({ ...f, actividades: f.actividades.filter((_, i) => i !== idx) }));
  const addInsumo = () => setForm(f => ({ ...f, insumos: [...f.insumos, { producto_id: '', descripcion_libre: '', cantidad: '', unidad: '' }] }));
  const updateInsumo = (idx, field, value) => setForm(f => { const ins = [...f.insumos]; ins[idx] = { ...ins[idx], [field]: value }; return { ...f, insumos: ins }; });
  const removeInsumo = (idx) => setForm(f => ({ ...f, insumos: f.insumos.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre) { toast.error('El nombre es requerido'); return; }
    if (form.tipo_entidad === 'EQUIPO' && !form.equipo_id) { toast.error('Debes seleccionar un equipo'); return; }
    if (form.tipo_entidad === 'AREA' && !form.area_id) { toast.error('Debes seleccionar un área'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        equipo_id: form.tipo_entidad === 'EQUIPO' ? (form.equipo_id ? parseInt(form.equipo_id) : null) : null,
        area_id: form.tipo_entidad === 'AREA' ? (form.area_id ? parseInt(form.area_id) : null) : null,
        frecuencia_valor: form.frecuencia_valor ? parseInt(form.frecuencia_valor) : null,
        duracion_estimada_horas: form.duracion_estimada_horas ? parseFloat(form.duracion_estimada_horas) : null,
        responsable_id: form.responsable_id || null,
        actividades: form.actividades.map(a => ({ ...a, tiempo_estimado_min: a.tiempo_estimado_min ? parseInt(a.tiempo_estimado_min) : null })),
        insumos: form.insumos.map(i => ({ ...i, cantidad: parseFloat(i.cantidad) || 0, producto_id: i.producto_id ? parseInt(i.producto_id) : null })),
      };
      if (isEdit) { await mpService.updatePlan(id, payload); toast.success('Plan actualizado'); }
      else { await mpService.createPlan(payload); toast.success('Plan creado'); }
      navigate('..');
    } catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={() => navigate('..')} className="btn btn--ghost"><ArrowLeft size={20} /></button>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{isEdit ? 'Editar Plan' : 'Nuevo Plan de Mantenimiento'}</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Información básica */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Información General</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Nombre *</label>
              <input type="text" required value={form.nombre} onChange={(e) => handleChange('nombre', e.target.value)} className="input" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Descripción</label>
              <textarea rows={3} value={form.descripcion} onChange={(e) => handleChange('descripcion', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Tipo de Entidad *</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                {['EQUIPO', 'AREA'].map(t => (
                  <label key={t} className="selectable-card" style={{ flex: 1, padding: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="tipo_entidad" value={t} checked={form.tipo_entidad === t}
                      onChange={(e) => handleChange('tipo_entidad', e.target.value)} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>{t === 'EQUIPO' ? 'Equipo' : 'Área'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="input-label">{form.tipo_entidad === 'EQUIPO' ? 'Equipo *' : 'Área *'}</label>
              <select required value={form.tipo_entidad === 'EQUIPO' ? form.equipo_id : form.area_id}
                onChange={(e) => handleChange(form.tipo_entidad === 'EQUIPO' ? 'equipo_id' : 'area_id', e.target.value)} className="input">
                <option value="">Seleccionar...</option>
                {(form.tipo_entidad === 'EQUIPO' ? equipos : areas).map(item => {
                  const label = item.nombre || (item.marca ? `${item.marca} ${item.modelo || ''}` : item.codigo) || `#${item.id?.substring(0,8)}`;
                  return <option key={item.id} value={item.id}>{label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="input-label">Tipo de Mantenimiento *</label>
              <select required value={form.tipo_mantenimiento} onChange={(e) => handleChange('tipo_mantenimiento', e.target.value)} className="input">
                <option value="PREVENTIVO">Preventivo</option>
                <option value="CORRECTIVO">Correctivo</option>
                <option value="PREDICTIVO">Predictivo</option>
                <option value="INSPECCION">Inspección</option>
              </select>
            </div>
            <div>
              <label className="input-label">Prioridad *</label>
              <select required value={form.prioridad} onChange={(e) => handleChange('prioridad', e.target.value)} className="input">
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
          </div>
        </div>

        {/* Frecuencia */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Frecuencia y Duración</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label">Frecuencia *</label>
              <select required value={form.frecuencia_tipo} onChange={(e) => handleChange('frecuencia_tipo', e.target.value)} className="input">
                <option value="DIAS">Días</option>
                <option value="SEMANAS">Semanas</option>
                <option value="MESES">Meses</option>
                <option value="HORAS">Horas</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <label className="input-label">Valor</label>
              <input type="number" min="1" value={form.frecuencia_valor}
                disabled={form.frecuencia_tipo === 'MANUAL'}
                onChange={(e) => handleChange('frecuencia_valor', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Duración estimada (horas)</label>
              <input type="number" step="0.5" min="0" value={form.duracion_estimada_horas}
                onChange={(e) => handleChange('duracion_estimada_horas', e.target.value)} className="input" />
            </div>
          </div>
        </div>

        {/* Responsable y vigencia */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Responsable y Vigencia</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label">Responsable</label>
              <select value={form.responsable_id} onChange={(e) => handleChange('responsable_id', e.target.value)} className="input">
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido || ''}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Inicio de vigencia *</label>
              <input type="date" required value={form.fecha_inicio_vigencia}
                onChange={(e) => handleChange('fecha_inicio_vigencia', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Fin de vigencia</label>
              <input type="date" value={form.fecha_fin_vigencia}
                onChange={(e) => handleChange('fecha_fin_vigencia', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="input-label">Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => handleChange('observaciones', e.target.value)} className="input" />
          </div>
        </div>

        {/* Actividades */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Actividades</h3>
            <button type="button" onClick={addActividad} className="btn btn--secondary btn--sm"><Plus size={14} /> Agregar</button>
          </div>
          {form.actividades.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin actividades registradas</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {form.actividades.map((act, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.5rem' }}>
                    <input type="text" placeholder="Descripción" value={act.descripcion}
                      onChange={(e) => updateActividad(idx, 'descripcion', e.target.value)} className="input" />
                    <input type="number" placeholder="Min. estimados" value={act.tiempo_estimado_min}
                      onChange={(e) => updateActividad(idx, 'tiempo_estimado_min', e.target.value)} className="input" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={act.obligatoria}
                          onChange={(e) => updateActividad(idx, 'obligatoria', e.target.checked)} /> Oblig.
                      </label>
                      <button type="button" onClick={() => removeActividad(idx)} className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }}><X size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insumos */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Insumos</h3>
            <button type="button" onClick={addInsumo} className="btn btn--secondary btn--sm"><Plus size={14} /> Agregar</button>
          </div>
          {form.insumos.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin insumos registrados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {form.insumos.map((ins, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px auto', gap: '0.5rem' }}>
                    <select value={ins.producto_id} onChange={(e) => updateInsumo(idx, 'producto_id', e.target.value)} className="input">
                      <option value="">Producto</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre || `#${p.id}`}</option>)}
                    </select>
                    <input type="text" placeholder="O descripción libre" value={ins.descripcion_libre}
                      onChange={(e) => updateInsumo(idx, 'descripcion_libre', e.target.value)} className="input" />
                    <input type="number" step="0.001" placeholder="Cant." value={ins.cantidad}
                      onChange={(e) => updateInsumo(idx, 'cantidad', e.target.value)} className="input" />
                    <input type="text" placeholder="Unidad" value={ins.unidad}
                      onChange={(e) => updateInsumo(idx, 'unidad', e.target.value)} className="input" />
                    <button type="button" onClick={() => removeInsumo(idx)} className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }}><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => navigate('..')} className="btn btn--secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn btn--primary">
            <Save size={16} /> {saving ? 'Guardando...' : isEdit ? 'Actualizar Plan' : 'Crear Plan'}
          </button>
        </div>
      </form>
    </div>
  );
}
