import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Shield } from 'lucide-react';
import api from '../../lib/api';

export function EmployeeSeguridadSocial({ employee, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({
    eps: employee?.eps || '',
    arl: employee?.arl || '',
    fondo_pension: employee?.fondo_pension || '',
  });

  const mutation = useMutation({
    mutationFn: async (payload) => api.patch(`/employees/${employee.id}`, payload),
    onSuccess: () => { toast.success('Seguridad social actualizada'); qc.invalidateQueries({ queryKey: ['employees'] }); onSuccess?.(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const handleChange = (e) => { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })); };
  const lbl = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Shield size={18} color="var(--clr-primary-500)" />
        <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Entidades de Seguridad Social</h3>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={lbl}>EPS (Entidad Promotora de Salud)</label>
          <input name="eps" className="input" style={{ width: '100%' }} value={form.eps} onChange={handleChange} placeholder="Ej: Sanitas, EPS Sura..." />
        </div>
        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={lbl}>ARL (Administradora de Riesgos Laborales)</label>
          <input name="arl" className="input" style={{ width: '100%' }} value={form.arl} onChange={handleChange} placeholder="Ej: Positiva, ARL Sura..." />
        </div>
        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={lbl}>Fondo de Pensiones</label>
          <input name="fondo_pension" className="input" style={{ width: '100%' }} value={form.fondo_pension} onChange={handleChange} placeholder="Ej: Proteccion, Porvenir..." />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Nota: Los numeros de afiliacion y fechas se pueden agregar en una futura actualizacion.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
