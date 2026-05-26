import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search } from 'lucide-react';
import api from '../../lib/api';

const MOTORES = ['Mazda', 'Toyota', 'Hyster'];
const COMBUSTIBLES = ['GLP', 'Gasolina', 'Eléctrico', 'Híbrido'];
const CAPACIDADES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

// Bonificación por tonelaje: 1-4T → $3,232 | 5-7T → $4,848
const calcBonificacion = (tons) => {
  const t = parseFloat(tons || 0);
  if (t >= 5) return 4848;
  if (t >= 1) return 3232;
  return 0;
};
const TIPOS_EQUIPO = [
  'Montacargas contrabalanceo',
  'Reach truck',
  'Montacargas eléctrico',
  'Elevador de tijera',
  'Elevador de mástil',
  'Otro',
];
const ESTADOS_INICIALES = ['Operativo', 'En taller', 'En bodega', 'Fuera de servicio'];
const UBICACIONES = ['Taller', 'Bodega', 'Exterior', 'Otro'];

const labelStyle = {
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '0.375rem',
};

const sectionTitle = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.875rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid var(--border-color)',
};

export function EquipoForm({ equipo, defaultCompanyId, onSuccess, onCancel }) {
  const qc = useQueryClient();
  const [companySearch, setCompanySearch] = React.useState(equipo?.empresa_nombre || '');
  const [showCompanyResults, setShowCompanyResults] = React.useState(false);

  const [form, setForm] = React.useState({
    empresa_id:                equipo?.empresa_id || defaultCompanyId || '',
    marca:                     equipo?.marca || '',
    modelo:                    equipo?.modelo || '',
    serial:                    equipo?.serial || '',
    numero_equipo:             equipo?.numero_equipo || '',
    motor:                     equipo?.motor || 'Mazda',
    combustible:               equipo?.combustible || 'GLP',
    capacidad_carga:           equipo?.capacidad_carga || 2.5,
    color:                     equipo?.color || '',
    // Nuevos campos
    tipo_equipo:               equipo?.tipo_equipo || 'Montacargas contrabalanceo',
    estado_inicial:            equipo?.estado_inicial || 'Operativo',
    ubicacion:                 equipo?.ubicacion || 'Taller',
    horometro_inicial:         equipo?.horometro_inicial ?? 0,
    fecha_adquisicion:         equipo?.fecha_adquisicion?.slice(0, 10) || '',
    fecha_vencimiento_garantia: equipo?.fecha_vencimiento_garantia?.slice(0, 10) || '',
    horas_operacion_diaria:    equipo?.horas_operacion_diaria || '',
    bonificacion_por_hora:     equipo?.bonificacion_por_hora ?? calcBonificacion(equipo?.capacidad_carga || 2.5),
  });

  // Auto-calcular bonificación al cambiar tonelaje
  React.useEffect(() => {
    if (!equipo) {
      // Solo auto-calcular en creación
      setForm(prev => ({ ...prev, bonificacion_por_hora: calcBonificacion(prev.capacidad_carga) }));
    }
  }, [form.capacidad_carga]);

  const { data: companiesData } = useQuery({
    queryKey: ['companies-search', companySearch],
    queryFn: async () => {
      const params = { limit: 20 };
      if (companySearch.trim()) params.search = companySearch;
      const { data } = await api.get('/companies', { params });
      return data.data;
    },
    enabled: showCompanyResults,
  });

  const mutation = useMutation({
    mutationFn: (payload) =>
      equipo ? api.put(`/equipos/${equipo.id}`, payload) : api.post('/equipos', payload),
    onSuccess: () => {
      toast.success(equipo ? 'Equipo actualizado' : 'Equipo registrado');
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['company-equipos'] });
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.empresa_id) { toast.error('Selecciona la empresa responsable'); return; }
    if (!form.serial)     { toast.error('El número de serial es obligatorio'); return; }
    if (!form.fecha_adquisicion) { toast.error('La fecha de adquisición es obligatoria'); return; }
    mutation.mutate(form);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── SECCIÓN 1: Empresa ─────────────────────────────── */}
      {!defaultCompanyId && (
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Empresa Responsable *</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              placeholder="Clic para ver empresas o buscar..."
              value={companySearch}
              onChange={(e) => { setCompanySearch(e.target.value); setShowCompanyResults(true); }}
              onFocus={() => setShowCompanyResults(true)}
            />
          </div>
          {showCompanyResults && companiesData?.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', marginTop: '0.25rem', boxShadow: 'var(--shadow-lg)',
              maxHeight: 220, overflowY: 'auto',
            }}>
              {companiesData.map(c => (
                <button
                  key={c.id}
                  type="button"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
                  onClick={() => { setForm(prev => ({ ...prev, empresa_id: c.id })); setCompanySearch(c.name); setShowCompanyResults(false); }}
                >
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NIT: {c.nit}</div>
                </button>
              ))}
            </div>
          )}
          {form.empresa_id && !showCompanyResults && (
            <div style={{ fontSize: '11px', color: 'var(--clr-primary-500)', marginTop: '0.25rem' }}>✓ Empresa seleccionada</div>
          )}
        </div>
      )}

      {/* ── SECCIÓN 2: Identificación ─────────────────────── */}
      <div>
        <p style={sectionTitle}>Identificación del Equipo</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Marca *</label>
              <input name="marca" className="input" style={{ width: '100%' }} value={form.marca} onChange={handleChange} required />
            </div>
            <div>
              <label style={labelStyle}>Modelo *</label>
              <input name="modelo" className="input" style={{ width: '100%' }} value={form.modelo} onChange={handleChange} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Número de Serial *</label>
              <input name="serial" className="input" style={{ width: '100%' }} value={form.serial} onChange={handleChange} required />
            </div>
            <div>
              <label style={labelStyle}>Número de Equipo</label>
              <input name="numero_equipo" className="input" style={{ width: '100%' }} value={form.numero_equipo} onChange={handleChange} placeholder="Ej: MQ-001" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Tipo de Equipo *</label>
              <select name="tipo_equipo" className="input" style={{ width: '100%' }} value={form.tipo_equipo} onChange={handleChange}>
                {TIPOS_EQUIPO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Color</label>
              <input name="color" className="input" style={{ width: '100%' }} value={form.color} onChange={handleChange} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: Especificaciones técnicas ──────────── */}
      <div>
        <p style={sectionTitle}>Especificaciones Técnicas</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Motor</label>
            <select name="motor" className="input" style={{ width: '100%' }} value={form.motor} onChange={handleChange}>
              {MOTORES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Combustible</label>
            <select name="combustible" className="input" style={{ width: '100%' }} value={form.combustible} onChange={handleChange}>
              {COMBUSTIBLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Capacidad (Ton)</label>
            <select name="capacidad_carga" className="input" style={{ width: '100%' }} value={form.capacidad_carga} onChange={handleChange}>
              {CAPACIDADES.map(cap => <option key={cap} value={cap}>{cap.toFixed(1)} Ton</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 4: Estado y Ubicación ─────────────────── */}
      <div>
        <p style={sectionTitle}>Estado Inicial &amp; Operación</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Estado Inicial *</label>
              <select name="estado_inicial" className="input" style={{ width: '100%' }} value={form.estado_inicial} onChange={handleChange}>
                {ESTADOS_INICIALES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ubicación *</label>
              <select name="ubicacion" className="input" style={{ width: '100%' }} value={form.ubicacion} onChange={handleChange}>
                {UBICACIONES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Horómetro Inicial (h) *</label>
              <input
                name="horometro_inicial"
                type="number"
                min="0"
                step="0.1"
                className="input"
                style={{ width: '100%' }}
                value={form.horometro_inicial}
                onChange={handleChange}
                placeholder="0"
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Horas acumuladas al momento del ingreso
              </span>
            </div>
            <div>
              <label style={labelStyle}>Fecha de Adquisición *</label>
              <input name="fecha_adquisicion" type="date" className="input" style={{ width: '100%' }} value={form.fecha_adquisicion} onChange={handleChange} required />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 5: Garantía y proyecciones (opcionales) ── */}
      <div>
        <p style={sectionTitle}>Garantía y Estimados <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcionales)</span></p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Fecha Vencimiento Garantía</label>
            <input name="fecha_vencimiento_garantia" type="date" className="input" style={{ width: '100%' }} value={form.fecha_vencimiento_garantia} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Horas Operación Diaria Estimada</label>
            <input
              name="horas_operacion_diaria"
              type="number"
              min="0"
              step="0.5"
              className="input"
              style={{ width: '100%' }}
              value={form.horas_operacion_diaria}
              onChange={handleChange}
              placeholder="Ej: 8"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
              Para proyectar cuándo se alcanzarán las 250h
            </span>
          </div>
        </div>
        {/* Bonificación por hora */}
        <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <label style={labelStyle}>Bonificación Total por Horas (COP)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              name="bonificacion_por_hora"
              type="number"
              min="0"
              step="1"
              className="input"
              style={{ width: 160 }}
              value={form.bonificacion_por_hora}
              onChange={handleChange}
              placeholder="0"
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn--ghost btn--sm"
                onClick={() => setForm(prev => ({ ...prev, bonificacion_por_hora: 3232 }))}>
                $3,232 (1–4T)
              </button>
              <button type="button" className="btn btn--ghost btn--sm"
                onClick={() => setForm(prev => ({ ...prev, bonificacion_por_hora: 4848 }))}>
                $4,848 (5–7T)
              </button>
            </div>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
            Se auto-asigna según la capacidad de carga. 1–4 Ton → $3,232 | 5–7 Ton → $4,848 — Editable manualmente.
          </span>
        </div>
      </div>

      {/* ── Acciones ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : equipo ? 'Guardar Cambios' : 'Crear Equipo'}
        </button>
      </div>
    </form>
  );
}
