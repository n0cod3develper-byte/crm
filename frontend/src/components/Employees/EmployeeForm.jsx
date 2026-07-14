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
    fecha_nacimiento: employee?.fecha_nacimiento ? employee.fecha_nacimiento.substring(0, 10) : '',
    direccion: employee?.direccion || '',
    contacto_emergencia_nombre: employee?.contacto_emergencia_nombre || '',
    contacto_emergencia_telefono: employee?.contacto_emergencia_telefono || '',
    eps: employee?.eps || '',
    arl: employee?.arl || '',
    fondo_pension: employee?.fondo_pension || '',
    tipo_sangre: employee?.tipo_sangre || '',
    tipo_contrato: employee?.tipo_contrato || '',
    salario: employee?.salario || 0,
    jornada: employee?.jornada || '',
    fecha_ingreso: employee?.fecha_ingreso ? employee.fecha_ingreso.substring(0, 10) : '',
    fecha_retiro: employee?.fecha_retiro ? employee.fecha_retiro.substring(0, 10) : '',
    motivo_retiro: employee?.motivo_retiro || '',
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
      
      // Sanitizar campos de fecha vacíos a null para evitar errores en base de datos
      const dateFields = ['fecha_nacimiento', 'fecha_ingreso', 'fecha_retiro'];
      dateFields.forEach(field => {
        if (cleanPayload[field] === '') {
          cleanPayload[field] = null;
        }
      });
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

      {/* ─── Sección de Gestión Humana (Oculta por defecto para no saturar) ── */}
      <details style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <summary style={{ fontWeight: 600, cursor: 'pointer', outline: 'none' }}>Datos de Gestión Humana</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={labelStyle}>Fecha de Nacimiento</label>
            <input type="date" name="fecha_nacimiento" className="input" style={{ width: '100%' }} value={form.fecha_nacimiento} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Dirección</label>
            <input name="direccion" className="input" style={{ width: '100%' }} value={form.direccion} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Contacto Emergencia (Nombre)</label>
            <input name="contacto_emergencia_nombre" className="input" style={{ width: '100%' }} value={form.contacto_emergencia_nombre} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Contacto Emergencia (Teléfono)</label>
            <input name="contacto_emergencia_telefono" className="input" style={{ width: '100%' }} value={form.contacto_emergencia_telefono} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>EPS</label>
            <input name="eps" className="input" style={{ width: '100%' }} value={form.eps} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>ARL</label>
            <input name="arl" className="input" style={{ width: '100%' }} value={form.arl} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Fondo de Pensión</label>
            <input name="fondo_pension" className="input" style={{ width: '100%' }} value={form.fondo_pension} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Tipo de Sangre</label>
            <input name="tipo_sangre" className="input" style={{ width: '100%' }} value={form.tipo_sangre} onChange={handleChange} placeholder="Ej: O+" />
          </div>
          <div>
            <label style={labelStyle}>Tipo de Contrato</label>
            <input name="tipo_contrato" className="input" style={{ width: '100%' }} value={form.tipo_contrato} onChange={handleChange} placeholder="Término Indefinido, Fijo..." />
          </div>
          <div>
            <label style={labelStyle}>Salario Mensual</label>
            <input type="number" name="salario" className="input" style={{ width: '100%' }} value={form.salario} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Jornada</label>
            <input name="jornada" className="input" style={{ width: '100%' }} value={form.jornada} onChange={handleChange} placeholder="Completa, Medio tiempo..." />
          </div>
          <div>
            <label style={labelStyle}>Fecha de Ingreso</label>
            <input type="date" name="fecha_ingreso" className="input" style={{ width: '100%' }} value={form.fecha_ingreso} onChange={handleChange} />
          </div>
          {form.status === 'Inactivo' && (
            <>
              <div>
                <label style={labelStyle}>Fecha de Retiro</label>
                <input type="date" name="fecha_retiro" className="input" style={{ width: '100%' }} value={form.fecha_retiro} onChange={handleChange} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Motivo de Retiro</label>
                <input name="motivo_retiro" className="input" style={{ width: '100%' }} value={form.motivo_retiro} onChange={handleChange} />
              </div>
            </>
          )}
        </div>
      </details>

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
