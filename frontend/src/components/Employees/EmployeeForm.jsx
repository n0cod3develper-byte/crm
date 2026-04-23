import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

const POSITIONS = ['Administrativo', 'Operario', 'Técnico'];
const STATUSES = ['Activo', 'Inactivo', 'Vacaciones'];

export function EmployeeForm({ employee, onSuccess, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({
    full_name: employee?.full_name || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    position: employee?.position || 'Administrativo',
    status: employee?.status || 'Activo',
    hourly_rate: employee?.hourly_rate || 0,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (employee) return api.patch(`/employees/${employee.id}`, payload);
      return api.post('/employees', payload);
    },
    onSuccess: () => {
      toast.success(employee ? 'Empleado actualizado' : 'Empleado creado');
      qc.invalidateQueries({ queryKey: ['employees'] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al guardar');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email) {
      toast.error('Nombre y Correo son obligatorios');
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
      <div>
        <label style={labelStyle}>Nombre Completo *</label>
        <input
          name="full_name"
          className="input"
          style={{ width: '100%' }}
          value={form.full_name}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <label style={labelStyle}>Teléfono</label>
        <input
          name="phone"
          className="input"
          style={{ width: '100%' }}
          value={form.phone}
          onChange={handleChange}
        />
      </div>
      <div>
        <label style={labelStyle}>Correo *</label>
        <input
          name="email"
          type="email"
          className="input"
          style={{ width: '100%' }}
          value={form.email}
          onChange={handleChange}
          required
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Cargo</label>
          <select name="position" className="input" style={{ width: '100%' }} value={form.position} onChange={handleChange}>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select name="status" className="input" style={{ width: '100%' }} value={form.status} onChange={handleChange}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Tarifa por hora (Mantenimiento)</label>
        <input
          name="hourly_rate"
          type="number"
          className="input"
          style={{ width: '100%' }}
          value={form.hourly_rate}
          onChange={handleChange}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : employee ? 'Actualizar' : 'Crear Empleado'}
        </button>
      </div>
    </form>
  );
}
