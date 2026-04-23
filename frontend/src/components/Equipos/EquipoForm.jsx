import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search } from 'lucide-react';
import api from '../../lib/api';

const MOTORES = ['Mazda', 'Toyota', 'Hyster'];
const COMBUSTIBLES = ['GLP', 'Gasolina', 'Eléctrico', 'Híbrido'];
const CAPACIDADES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

export function EquipoForm({ equipo, defaultCompanyId, onSuccess, onCancel }) {
  const qc = useQueryClient();
  const [companySearch, setCompanySearch] = React.useState('');
  const [showCompanyResults, setShowCompanyResults] = React.useState(false);

  const [form, setForm] = React.useState({
    empresa_id: equipo?.empresa_id || defaultCompanyId || '',
    marca: equipo?.marca || '',
    modelo: equipo?.modelo || '',
    serial: equipo?.serial || '',
    motor: equipo?.motor || 'Mazda',
    combustible: equipo?.combustible || 'GLP',
    capacidad_carga: equipo?.capacidad_carga || 2.5,
    color: equipo?.color || '',
  });

  // Cargar lista de empresas para el selector
  const { data: companiesData } = useQuery({
    queryKey: ['companies-search', companySearch],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params: { search: companySearch, limit: 5 } });
      return data.data;
    },
    enabled: companySearch.length > 2,
  });

  const mutation = useMutation({
    mutationFn: (payload) => {
      if (equipo) return api.put(`/equipos/${equipo.id}`, payload);
      return api.post('/equipos', payload);
    },
    onSuccess: () => {
      toast.success(equipo ? 'Equipo actualizado' : 'Equipo registrado');
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['company-equipos'] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.empresa_id || !form.serial) {
      toast.error('Empresa y Serial son obligatorios');
      return;
    }
    mutation.mutate(form);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
      
      {/* Selector de Empresa */}
      {!defaultCompanyId && (
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Empresa Responsable *</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              placeholder="Buscar empresa (mín 3 letras)..."
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
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', marginTop: '0.25rem', boxShadow: 'var(--shadow-lg)'
            }}>
              {companiesData.map(c => (
                <button
                  key={c.id}
                  type="button"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
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
            <div style={{ fontSize: '11px', color: 'var(--clr-primary-500)', marginTop: '0.25rem' }}>
              ✓ Empresa seleccionada
            </div>
          )}
        </div>
      )}

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

      <div>
        <label style={labelStyle}>Número de Serial *</label>
        <input name="serial" className="input" style={{ width: '100%' }} value={form.serial} onChange={handleChange} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Capacidad (Ton)</label>
          <select name="capacidad_carga" className="input" style={{ width: '100%' }} value={form.capacidad_carga} onChange={handleChange}>
            {CAPACIDADES.map(cap => <option key={cap} value={cap}>{cap.toFixed(1)} Ton</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Color</label>
          <input name="color" className="input" style={{ width: '100%' }} value={form.color} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : equipo ? 'Guardar Cambios' : 'Crear Equipo'}
        </button>
      </div>
    </form>
  );
}
