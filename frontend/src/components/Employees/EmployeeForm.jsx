import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { User, Link, Unlink } from 'lucide-react';
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
    user_id: employee?.user_id || '',
    tipo_documento: employee?.tipo_documento || '',
    numero_documento: employee?.numero_documento || '',
    departamento: employee?.departamento || '',
  });

  // Obtener usuarios disponibles para vincular
  const usuariosQuery = useQuery({
    queryKey: ['usuarios-disponibles', employee?.id],
    queryFn: async () => {
      const params = employee?.id ? { empleado_id: employee.id } : {};
      const { data } = await api.get('/employees/usuarios-disponibles', { params });
      return data.data || [];
    },
    enabled: true,
  });

  const usuarios = usuariosQuery.data || [];

  const mutation = useMutation({
    mutationFn: async (payload) => {
      // Limpiar user_id si es string vacío (desvincular)
      const cleanPayload = { ...payload };
      if (cleanPayload.user_id === '' || cleanPayload.user_id === 'ninguno') {
        cleanPayload.user_id = null;
      }
      if (employee) return api.patch(`/employees/${employee.id}`, cleanPayload);
      return api.post('/employees', cleanPayload);
    },
    onSuccess: () => {
      toast.success(employee ? 'Empleado actualizado' : 'Empleado creado');
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['usuarios-disponibles'] });
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

  const usuarioSeleccionado = usuarios.find(u => u.id === form.user_id);

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Tipo Documento</label>
          <select name="tipo_documento" className="input" style={{ width: '100%' }} value={form.tipo_documento} onChange={handleChange}>
            <option value="">Seleccionar...</option>
            <option value="CC">CC — Cédula de Ciudadanía</option>
            <option value="TE">TE — Tarjeta de Identidad</option>
            <option value="TI">TI — Tarjeta de Identidad</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Número de Documento</label>
          <input
            name="numero_documento"
            className="input"
            style={{ width: '100%' }}
            value={form.numero_documento}
            onChange={handleChange}
            placeholder="Ej: 1234567890"
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Departamento / Área de la Empresa</label>
        <input
          name="departamento"
          className="input"
          style={{ width: '100%' }}
          value={form.departamento}
          onChange={handleChange}
          placeholder="Ej: Sistemas, Contabilidad, Operaciones"
        />
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

      {/* ─── Vinculación con usuario del sistema ──────────────── */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '1rem',
        marginTop: '0.5rem',
      }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Link size={14} /> Vincular a usuario del sistema
        </label>
        {usuariosQuery.isLoading ? (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
            Cargando usuarios...
          </div>
        ) : (
          <>
            <select
              name="user_id"
              className="input"
              style={{ width: '100%' }}
              value={form.user_id || 'ninguno'}
              onChange={handleChange}
            >
              <option value="ninguno">— Sin vincular —</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} ({u.email})
                </option>
              ))}
            </select>
            <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.375rem', lineHeight: 1.4 }}>
              {form.user_id && form.user_id !== 'ninguno' ? (
                <>El empleado podrá iniciar turno con la cuenta de <strong>{usuarioSeleccionado?.nombre} {usuarioSeleccionado?.apellido}</strong></>
              ) : (
                'Selecciona un usuario para que este empleado pueda usar el módulo de Turnos.'
              )}
            </p>
          </>
        )}
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
