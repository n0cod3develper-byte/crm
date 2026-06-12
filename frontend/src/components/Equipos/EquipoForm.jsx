import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, ChevronDown, ChevronUp, AlertCircle, HardDrive, Settings, Activity, MapPin } from 'lucide-react';
import api from '../../lib/api';
import { FotoEquipo } from './FotoEquipo';
import {
  CAPACIDADES_NOMINALES,
  TIPOS_MASTIL,
  ALTURAS_MAXIMAS,
  TIPOS_PROPULSION,
  ESTADOS_EQUIPO,
  TIPOS_EQUIPO,
  TIPOS_REQUIEREN_SOAT,
  ESTADOS_REQUIEREN_MOTIVO,
} from '../../constants/equipos';

/* ================================================================
   Estilos reutilizables del formulario
   ================================================================ */
const label = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '0.35rem',
  letterSpacing: '0.01em',
};

const halfField = {
  gridColumn: 'span 1',
};

const fullField = {
  gridColumn: '1 / -1',
};

const inputPremium = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.65rem 0.875rem',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  transition: 'border-color 200ms ease, box-shadow 200ms ease, background 200ms ease',
  outline: 'none',
};

/* ================================================================ */

export function EquipoForm({ equipo, defaultCompanyId, onSuccess, onCancel }) {
  const qc = useQueryClient();
  const [companySearch, setCompanySearch] = React.useState(equipo?.empresa_nombre || '');
  const [showCompanyResults, setShowCompanyResults] = React.useState(false);
  const [openSection, setOpenSection] = React.useState('general');

  const [form, setForm] = React.useState({
    empresa_id: equipo?.empresa_id || defaultCompanyId || '',
    marca: equipo?.marca || '',
    modelo: equipo?.modelo || '',
    serial: equipo?.serial || '',
    motor: equipo?.motor || 'Mazda',
    combustible: equipo?.combustible || 'GLP',
    capacidad_carga: equipo?.capacidad_carga || 2.5,
    color: equipo?.color || '',
    // Nuevos campos
    serie: equipo?.serie || '',
    tipo_equipo: equipo?.tipo_equipo || 'MONTACARGAS',
    capacidad_nominal: equipo?.capacidad_nominal || '',
    tipo_mastil: equipo?.tipo_mastil || '',
    altura_maxima: equipo?.altura_maxima || '',
    tipo_propulsion: equipo?.tipo_propulsion || '',
    horometro_actual: equipo?.horometro_actual || 0,
    odometro: equipo?.odometro || 0,
    ubicacion_fisica: equipo?.ubicacion_fisica || '',
    ciudad_ubicacion: equipo?.ciudad_ubicacion || '',
    estado: equipo?.estado || 'OPERATIVO',
    motivo_estado: equipo?.motivo_estado || '',
    soat_vigente: equipo?.soat_vigente ?? false,
    soat_vencimiento: equipo?.soat_vencimiento || '',
    bonificacion_hora: equipo?.bonificacion_hora || 0,
  });

  // Cargar lista de empresas para el selector
  const { data: companiesData } = useQuery({
    queryKey: ['companies-search', companySearch],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params: { search: companySearch, limit: 5 } });
      return data.data;
    },
    enabled: companySearch.length > 2 && companySearch !== equipo?.empresa_nombre,
  });

  const mutation = useMutation({
    mutationFn: (payload) => {
      if (equipo) return api.put(`/equipos/${equipo.id}`, payload);
      return api.post('/equipos', payload);
    },
    onSuccess: () => {
      toast.success(equipo ? 'Equipo actualizado con éxito' : 'Equipo registrado con éxito');
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['company-equipos'] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al guardar el equipo');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.empresa_id) {
      toast.error('La empresa es obligatoria');
      setOpenSection('general');
      return;
    }
    if (!form.serial) {
      toast.error('El número de serial es obligatorio');
      setOpenSection('general');
      return;
    }

    // Validar horómetro no decreciente si estamos editando
    if (equipo && parseFloat(form.horometro_actual) < (parseFloat(equipo.horometro_actual) || 0)) {
      toast.error(`El horómetro no puede ser menor al valor actual de ${equipo.horometro_actual} horas`);
      setOpenSection('metrics');
      return;
    }

    // Validar motivo si estado es crítico
    if (ESTADOS_REQUIEREN_MOTIVO.includes(form.estado) && (!form.motivo_estado || !form.motivo_estado.trim())) {
      toast.error(`El motivo es obligatorio cuando el estado es ${form.estado}`);
      setOpenSection('location');
      return;
    }

    mutation.mutate(form);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Sincronizar combustible de forma retrocompatible al cambiar propulsion
  const handlePropulsionChange = (e) => {
    const val = e.target.value;
    let combustibleVal = 'GLP';
    if (val === 'GLP') combustibleVal = 'GLP';
    else if (val === 'GASOLINA') combustibleVal = 'Gasolina';
    else if (val === 'ELECTRICO_BATERIA_PLOMO') combustibleVal = 'Eléctrico';
    else if (val === 'ELECTRICO_BATERIA_LITIO') combustibleVal = 'Híbrido';

    setForm(prev => ({
      ...prev,
      tipo_propulsion: val,
      combustible: combustibleVal
    }));
  };

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  /* ─── Section Accordion Styles ────────────────────────────── */

  const sectionHeaderStyle = (section) => {
    const isOpen = openSection === section;
    const base = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.875rem 1.125rem',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 'var(--text-sm)',
      userSelect: 'none',
      transition: 'all 250ms ease',
    };
    if (isOpen) {
      return {
        ...base,
        background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.02) 100%)',
        border: '1px solid var(--border-color)',
        borderLeft: '3px solid var(--clr-primary-500)',
        borderBottom: 'none',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        color: 'var(--clr-primary-500)',
      };
    }
    return {
      ...base,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--text-primary)',
    };
  };

  const sectionContentStyle = (section) => {
    const isOpen = openSection === section;
    return {
      display: isOpen ? 'grid' : 'none',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem 1.25rem',
      padding: '1.25rem 1.125rem',
      border: '1px solid var(--border-color)',
      borderTop: 'none',
      borderBottomLeftRadius: 'var(--radius-lg)',
      borderBottomRightRadius: 'var(--radius-lg)',
      marginTop: '-1px',
      marginBottom: '0.875rem',
      background: 'var(--bg-surface)',
    };
  };

  /* ─── Helpers para renderizar inputs ──────────────────────── */

  const renderInput = (name, placeholder, opts = {}) => {
    const { type = 'text', step, min, required, spanFull, inputPlaceholder } = opts;
    return (
      <div key={name} style={spanFull ? fullField : halfField} className="equipo-field">
        <label style={label}>{placeholder}{required ? ' *' : ''}</label>
        <input
          name={name}
          type={type}
          className="input"
          style={inputPremium}
          placeholder={inputPlaceholder || placeholder}
          value={form[name] ?? ''}
          onChange={handleChange}
          step={step}
          min={min}
          required={required}
        />
      </div>
    );
  };

  const renderSelect = (name, labelText, options, onChange, opts = {}) => {
    const { required, spanFull } = opts;
    return (
      <div key={name} style={spanFull ? fullField : halfField} className="equipo-field">
        <label style={label}>{labelText}{required ? ' *' : ''}</label>
        <select
          name={name}
          className="input"
          style={{ ...inputPremium, cursor: 'pointer' }}
          value={form[name] ?? ''}
          onChange={onChange || handleChange}
          required={required}
        >
          {options}
        </select>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>

      {/* ─── Layout responsive: Foto lado derecho / abajo ─── */}
      <div className="equipo-form-layout" style={{
        display: 'flex',
        flexDirection: window.innerWidth > 960 ? 'row' : 'column',
        gap: '1.25rem',
        alignItems: 'flex-start',
      }}>

        {/* Foto del Equipo (solo edición) */}
        {equipo?.id && (
          <div className="equipo-form-sidebar" style={{
            flex: '0 0 260px',
            width: '100%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'sticky',
            top: '1rem',
          }}>
            <h4 style={{ margin: '0 0 0.875rem 0', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Foto del Activo
            </h4>
            <FotoEquipo
              equipoId={equipo.id}
              currentFotoUrl={equipo.foto_url}
              onUploadSuccess={() => {
                qc.invalidateQueries({ queryKey: ['equipos'] });
                qc.invalidateQueries({ queryKey: ['company-equipos'] });
              }}
              onDeleteSuccess={() => {
                qc.invalidateQueries({ queryKey: ['equipos'] });
                qc.invalidateQueries({ queryKey: ['company-equipos'] });
              }}
            />
          </div>
        )}

        {/* ─── Formulario ──────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>

          {/* ══════════════════════════════════════════════════
              SECCIÓN 1: INFORMACIÓN GENERAL
              ══════════════════════════════════════════════════ */}
          <div>
            <div
              style={sectionHeaderStyle('general')}
              onClick={() => toggleSection('general')}
              onMouseEnter={(e) => { if (openSection !== 'general') e.currentTarget.style.borderColor = 'var(--clr-primary-300)'; }}
              onMouseLeave={(e) => { if (openSection !== 'general') e.currentTarget.style.borderColor = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <HardDrive size={16} strokeWidth={2} />
                <span>1. Información General</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: openSection === 'general' ? 'rgba(37,99,235,0.1)' : 'var(--bg-elevated)',
                transition: 'background 200ms ease',
              }}>
                {openSection === 'general'
                  ? <ChevronUp size={14} strokeWidth={2.5} />
                  : <ChevronDown size={14} strokeWidth={2.5} />
                }
              </div>
            </div>

            <div style={sectionContentStyle('general')} className="equipo-section-grid">
              {/* Empresa Responsable — ancho completo */}
              {!defaultCompanyId && (
                <div style={{ ...fullField, position: 'relative' }}>
                  <label style={label}>Empresa Responsable *</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      className="input"
                      style={{ ...inputPremium, paddingLeft: '2.625rem' }}
                      placeholder="Buscar empresa por nombre o NIT..."
                      value={companySearch}
                      onChange={(e) => {
                        setCompanySearch(e.target.value);
                        setShowCompanyResults(true);
                      }}
                      onFocus={() => setShowCompanyResults(true)}
                    />
                  </div>
                  {showCompanyResults && companiesData?.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      marginTop: '0.25rem',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                    }}>
                      {companiesData.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          style={{
                            width: '100%', padding: '0.75rem 0.875rem', textAlign: 'left',
                            border: 'none', borderBottom: '1px solid var(--border-subtle)',
                            background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
                            color: 'var(--text-primary)',
                            transition: 'background 150ms ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          onClick={() => {
                            setForm(prev => ({ ...prev, empresa_id: c.id }));
                            setCompanySearch(c.name);
                            setShowCompanyResults(false);
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NIT: {c.nit}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.empresa_id && !showCompanyResults && (
                    <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                      Empresa vinculada correctamente
                    </div>
                  )}
                </div>
              )}

              {/* Tarjetas de Tipo de Activo — ancho completo */}
              <div style={fullField}>
                <label style={label}>Tipo de Activo *</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: '0.625rem',
                  marginTop: '0.25rem',
                }}>
                  {TIPOS_EQUIPO.map(t => {
                    const isSelected = form.tipo_equipo === t.valor;
                    return (
                      <button
                        key={t.valor}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, tipo_equipo: t.valor }))}
                        className="equipo-type-card"
                        style={{
                          padding: '0.75rem 0.5rem',
                          borderRadius: 'var(--radius-lg)',
                          border: isSelected
                            ? '2px solid var(--clr-primary-500)'
                            : '1px solid var(--border-color)',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.06) 100%)'
                            : 'var(--bg-surface)',
                          color: isSelected ? 'var(--clr-primary-500)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.375rem',
                          transition: 'all 200ms ease',
                          boxShadow: isSelected
                            ? '0 4px 12px rgba(37,99,235,0.15)'
                            : '0 1px 3px rgba(0,0,0,0.04)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--clr-primary-300)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                          }
                        }}
                      >
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: 0, right: 0,
                            width: 20, height: 20,
                            background: 'var(--clr-primary-500)',
                            clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white" style={{ position: 'absolute', top: 1, right: 1 }}>
                              <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" fill="none"/>
                            </svg>
                          </div>
                        )}
                        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{t.icono}</span>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Marca + Modelo */}
              <div>
                <label style={label}>Marca *</label>
                <input name="marca" className="input" style={inputPremium} value={form.marca} onChange={handleChange} required placeholder="Ej: Toyota" />
              </div>
              <div>
                <label style={label}>Modelo *</label>
                <input name="modelo" className="input" style={inputPremium} value={form.modelo} onChange={handleChange} required placeholder="Ej: FG15" />
              </div>

              {/* Serial + Serie / Código Interno */}
              <div>
                <label style={label}>Número de Serial *</label>
                <input name="serial" className="input" style={inputPremium} value={form.serial} onChange={handleChange} required placeholder="Ej: 8FG15-12345" />
              </div>
              <div>
                <label style={label}>Serie / Código Interno</label>
                <input name="serie" className="input" style={inputPremium} placeholder="Ej: MQ-102" value={form.serie} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECCIÓN 2: ESPECIFICACIONES TÉCNICAS
              ══════════════════════════════════════════════════ */}
          <div>
            <div
              style={sectionHeaderStyle('technical')}
              onClick={() => toggleSection('technical')}
              onMouseEnter={(e) => { if (openSection !== 'technical') e.currentTarget.style.borderColor = 'var(--clr-primary-300)'; }}
              onMouseLeave={(e) => { if (openSection !== 'technical') e.currentTarget.style.borderColor = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Settings size={16} strokeWidth={2} />
                <span>2. Especificaciones Técnicas</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: openSection === 'technical' ? 'rgba(37,99,235,0.1)' : 'var(--bg-elevated)',
                transition: 'background 200ms ease',
              }}>
                {openSection === 'technical'
                  ? <ChevronUp size={14} strokeWidth={2.5} />
                  : <ChevronDown size={14} strokeWidth={2.5} />
                }
              </div>
            </div>

            <div style={sectionContentStyle('technical')} className="equipo-section-grid">
              {renderSelect('tipo_propulsion', 'Propulsión / Combustible',
                [<option key="" value="">Selecciona propulsión...</option>,
                  ...TIPOS_PROPULSION.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)],
                handlePropulsionChange
              )}
              {renderSelect('capacidad_nominal', 'Capacidad Nominal (Ton)',
                [<option key="" value="">Selecciona capacidad...</option>,
                  ...CAPACIDADES_NOMINALES.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)]
              )}
              {renderSelect('tipo_mastil', 'Tipo de Mástil',
                [<option key="" value="">Selecciona tipo mástil...</option>,
                  ...TIPOS_MASTIL.map(m => <option key={m.valor} value={m.valor}>{m.label}</option>)]
              )}
              {renderSelect('altura_maxima', 'Altura Máxima Mástil (m)',
                [<option key="" value="">Selecciona altura...</option>,
                  ...ALTURAS_MAXIMAS.map(a => <option key={a.valor} value={a.valor}>{a.label}</option>)]
              )}
              <div key="motor" style={halfField} className="equipo-field">
                <label style={label}>Motor Fabricante</label>
                <input
                  name="motor"
                  className="input"
                  style={inputPremium}
                  placeholder="Ej: Mazda"
                  value={form.motor ?? ''}
                  onChange={handleChange}
                  list="motores-list"
                />
                <datalist id="motores-list">
                  <option value="Mazda" />
                  <option value="Toyota" />
                  <option value="Nissan" />
                  <option value="Isuzu" />
                  <option value="N/A" />
                  <option value="Hyster" />
                </datalist>
              </div>
              {renderInput('color', 'Color del Chasis', { inputPlaceholder: 'Ej: Amarillo' })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECCIÓN 3: MÉTRICAS OPERATIVAS
              ══════════════════════════════════════════════════ */}
          <div>
            <div
              style={sectionHeaderStyle('metrics')}
              onClick={() => toggleSection('metrics')}
              onMouseEnter={(e) => { if (openSection !== 'metrics') e.currentTarget.style.borderColor = 'var(--clr-primary-300)'; }}
              onMouseLeave={(e) => { if (openSection !== 'metrics') e.currentTarget.style.borderColor = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Activity size={16} strokeWidth={2} />
                <span>3. Métricas Operativas</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: openSection === 'metrics' ? 'rgba(37,99,235,0.1)' : 'var(--bg-elevated)',
                transition: 'background 200ms ease',
              }}>
                {openSection === 'metrics'
                  ? <ChevronUp size={14} strokeWidth={2.5} />
                  : <ChevronDown size={14} strokeWidth={2.5} />
                }
              </div>
            </div>

            <div style={sectionContentStyle('metrics')} className="equipo-section-grid">
              <div>
                <label style={label}>Horómetro Actual (Hrs)</label>
                <input
                  type="number"
                  name="horometro_actual"
                  className="input"
                  style={inputPremium}
                  step="0.1"
                  min={equipo ? equipo.horometro_actual : 0}
                  value={form.horometro_actual}
                  onChange={handleChange}
                  placeholder="0.0"
                />
                {equipo && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Valor actual: {equipo.horometro_actual} hrs. No se puede reducir.
                  </span>
                )}
              </div>

              <div>
                <label style={label}>Odómetro / Kilometraje (Km)</label>
                <input
                  type="number"
                  name="odometro"
                  className="input"
                  style={inputPremium}
                  step="0.1"
                  min="0"
                  value={form.odometro}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>

              <div style={fullField}>
                <label style={label}>Bonificación por Hora ($)</label>
                <input
                  type="number"
                  name="bonificacion_hora"
                  className="input"
                  style={inputPremium}
                  step="0.01"
                  min="0"
                  value={form.bonificacion_hora}
                  onChange={handleChange}
                  placeholder="0.00"
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Valor monetario de bonificación por cada hora de operación del equipo.
                </span>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECCIÓN 4: UBICACIÓN Y ESTADO
              ══════════════════════════════════════════════════ */}
          <div>
            <div
              style={sectionHeaderStyle('location')}
              onClick={() => toggleSection('location')}
              onMouseEnter={(e) => { if (openSection !== 'location') e.currentTarget.style.borderColor = 'var(--clr-primary-300)'; }}
              onMouseLeave={(e) => { if (openSection !== 'location') e.currentTarget.style.borderColor = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <MapPin size={16} strokeWidth={2} />
                <span>4. Ubicación y Estado</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: openSection === 'location' ? 'rgba(37,99,235,0.1)' : 'var(--bg-elevated)',
                transition: 'background 200ms ease',
              }}>
                {openSection === 'location'
                  ? <ChevronUp size={14} strokeWidth={2.5} />
                  : <ChevronDown size={14} strokeWidth={2.5} />
                }
              </div>
            </div>

            <div style={sectionContentStyle('location')} className="equipo-section-grid">
              {renderSelect('estado', 'Estado Operativo *',
                ESTADOS_EQUIPO.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>),
                null,
                { required: true }
              )}

              <div>
                <label style={label}>Ciudad de Ubicación</label>
                <input name="ciudad_ubicacion" className="input" style={inputPremium} placeholder="Ej: Bogotá" value={form.ciudad_ubicacion} onChange={handleChange} />
              </div>

              {/* Ubicación Física — ancho completo */}
              <div style={fullField}>
                <label style={label}>Ubicación Física Específica</label>
                <input name="ubicacion_fisica" className="input" style={inputPremium} placeholder="Ej: Bodega Central - Rampa 3" value={form.ubicacion_fisica} onChange={handleChange} />
              </div>

              {/* ─── SOAT ─── */}
              <div style={{
                  ...fullField,
                  background: 'rgba(37, 99, 235, 0.04)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--clr-primary-500)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="6" width="18" height="12" rx="2"/>
                      <path d="M3 10h18"/>
                      <path d="M7 15h.01"/>
                      <path d="M11 15h2"/>
                    </svg>
                    <span>SOAT — Seguro Obligatorio</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                    Registra si el equipo cuenta con SOAT vigente y su fecha de vencimiento.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        userSelect: 'none',
                      }}>
                        <div
                          onClick={() => setForm(prev => ({ ...prev, soat_vigente: !prev.soat_vigente }))}
                          style={{
                            width: 44,
                            height: 24,
                            borderRadius: 12,
                            background: form.soat_vigente ? 'var(--clr-primary-500)' : 'var(--border-color)',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background 200ms ease',
                            flexShrink: 0,
                          }}
                        >
                          <div style={{
                            width: 18, height: 18,
                            borderRadius: '50%',
                            background: 'white',
                            position: 'absolute',
                            top: 3,
                            left: form.soat_vigente ? 23 : 3,
                            transition: 'left 200ms ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </div>
                        <span>{form.soat_vigente ? 'Con SOAT vigente' : 'Sin SOAT'}</span>
                      </label>
                    </div>

                    {form.soat_vigente && (
                      <div>
                        <label style={label}>Fecha de Vencimiento *</label>
                        <input
                          type="date"
                          name="soat_vencimiento"
                          className="input"
                          style={{ ...inputPremium, minWidth: 0 }}
                          value={form.soat_vencimiento}
                          onChange={handleChange}
                          required={form.soat_vigente}
                        />
                      </div>
                    )}
                  </div>
                </div>

              {/* Justificación obligatoria para estados críticos */}
              {ESTADOS_REQUIEREN_MOTIVO.includes(form.estado) && (
                <div style={{
                  ...fullField,
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                    <AlertCircle size={15} />
                    <span>Justificación de Estado Requerida *</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                    Debes ingresar de forma obligatoria el motivo detallado de por qué la máquina se encuentra en estado <strong>{form.estado}</strong>.
                  </p>
                  <textarea
                    name="motivo_estado"
                    className="input"
                    style={{ ...inputPremium, minHeight: '80px', marginTop: '0.125rem', resize: 'vertical' }}
                    placeholder="Escribe el motivo técnico u operativo aquí..."
                    value={form.motivo_estado}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* ─── Botones de acción ─────────────────────────── */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <button type="button" className="btn btn--ghost" onClick={onCancel}
              style={{ padding: '0.625rem 1.25rem', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={mutation.isPending}
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                borderRadius: 'var(--radius-lg)',
                background: mutation.isPending
                  ? undefined
                  : 'linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-600))',
              }}
            >
              {mutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Guardando...
                </span>
              ) : (
                equipo ? 'Guardar Cambios' : 'Crear Equipo'
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
