import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { User, Link, Unlink } from 'lucide-react';
import api from '../../lib/api';

const POSITIONS = ['Administrativo', 'Operario', 'Técnico'];
const STATUSES = ['Activo', 'Inactivo', 'Vacaciones'];
const GRADOS_ESCOLARIDAD = [
  'NINGUNA', 'PRIMARIA INCOMPLETA', 'PRIMARIA', 'BACHILLERATO INCOMPLETO',
  'BACHILLERATO', 'TECNICA', 'TECNOLOGICA', 'PROFESIONAL'
];
const ESTADOS_CIVILES = [
  'SOLTERO(A)', 'CASADO(A)', 'UNION LIBRE', 'SEPARADO', 'DIVORCIADO', 'VIUDO(A)'
];
const COMPOSICION_FAMILIAR = [
  'SIN HIJOS', '1-2 HIJOS', '3-5 HIJOS', '6 O MAS HIJOS'
];
const RAZAS = ['BLANCO', 'NEGRO', 'MESTIZO'];
const ESTRATOS = ['1', '2', '3', '4', '5', '6'];

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
    correo_personal: employee?.correo_personal || '',
    // Información Personal
    fecha_nacimiento: employee?.fecha_nacimiento ? employee.fecha_nacimiento.substring(0, 10) : '',
    estado_civil: employee?.estado_civil || '',
    composicion_familiar: employee?.composicion_familiar || '',
    grado_escolaridad: employee?.grado_escolaridad || '',
    raza: employee?.raza || '',
    estrato: employee?.estrato || '',
    // Contacto
    direccion: employee?.direccion || '',
    contacto_emergencia_nombre: employee?.contacto_emergencia_nombre || '',
    contacto_emergencia_telefono: employee?.contacto_emergencia_telefono || '',
    // Campos que se envían en creación (Datos Laborales / Seguridad Social)
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
    tipo_vinculacion: employee?.tipo_vinculacion || '',
    sede: employee?.sede || '',
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
  const sectionTitle = { fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', paddingBottom: '0.375rem', borderBottom: '1px solid var(--border-color)' };

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

      <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '1rem' }}>
        <label style={{ ...labelStyle, color: 'var(--clr-primary-500)' }}>Correo Personal *</label>
        <input type="email" name="correo_personal" className="input" style={{ width: '100%' }} value={form.correo_personal} onChange={handleChange} placeholder="correo@personal.com" />
        {!form.correo_personal && <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '0.25rem' }}>⚠️ Sin correo personal — el empleado no podrá usar el portal público de certificados.</p>}
        {form.correo_personal && <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Distinto del correo empresarial usado para autenticación.</p>}
      </div>

      {/* ─── Información Personal ─────────────────────── */}
      <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={sectionTitle}>Información Personal</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Fecha de Nacimiento</label>
            <input type="date" name="fecha_nacimiento" className="input" style={{ width: '100%' }} value={form.fecha_nacimiento} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Estado Civil</label>
            <select name="estado_civil" className="input" style={{ width: '100%' }} value={form.estado_civil} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              {ESTADOS_CIVILES.map(ec => <option key={ec} value={ec}>{ec}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Composición Familiar</label>
            <select name="composicion_familiar" className="input" style={{ width: '100%' }} value={form.composicion_familiar} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              {COMPOSICION_FAMILIAR.map(cf => <option key={cf} value={cf}>{cf}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Grado de Escolaridad</label>
            <select name="grado_escolaridad" className="input" style={{ width: '100%' }} value={form.grado_escolaridad} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              {GRADOS_ESCOLARIDAD.map(ge => <option key={ge} value={ge}>{ge}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Raza (Opcional - Autodeclaración)</label>
            <select name="raza" className="input" style={{ width: '100%' }} value={form.raza} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              {RAZAS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Estrato Socioeconómico</label>
            <select name="estrato" className="input" style={{ width: '100%' }} value={form.estrato} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              {ESTRATOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Contacto y Emergencia ────────────────────── */}
      <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={sectionTitle}>Contacto y Emergencia</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Lugar de Residencia</label>
            <input name="direccion" className="input" style={{ width: '100%' }} value={form.direccion} onChange={handleChange} placeholder="Dirección de residencia" />
          </div>
          <div>
            <label style={labelStyle}>En Caso de Emergencia Llamar a (Nombre)</label>
            <input name="contacto_emergencia_nombre" className="input" style={{ width: '100%' }} value={form.contacto_emergencia_nombre} onChange={handleChange} placeholder="Nombre del contacto" />
          </div>
          <div>
            <label style={labelStyle}>Teléfono de Emergencia</label>
            <input name="contacto_emergencia_telefono" className="input" style={{ width: '100%' }} value={form.contacto_emergencia_telefono} onChange={handleChange} placeholder="Teléfono del contacto" />
          </div>
        </div>
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
