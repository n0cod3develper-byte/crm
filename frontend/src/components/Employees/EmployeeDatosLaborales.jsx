import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

const TIPOS_CONTRATO = [
  'Termino Indefinido', 'Termino Fijo', 'Obra/Labor',
  'Prestacion de Servicios', 'Aprendizaje', 'Temporal'
];

export function EmployeeDatosLaborales({ employee, userRole, onSuccess }) {
  const qc = useQueryClient();
  const isRRHH = ['admin', 'rrhh', 'gerencia'].includes(userRole);

  const [form, setForm] = React.useState({
    tipo_contrato: employee?.tipo_contrato || '',
    salario: employee?.salario || 0,
    fecha_ingreso: employee?.fecha_ingreso ? employee.fecha_ingreso.substring(0, 10) : '',
    fecha_retiro: employee?.fecha_retiro ? employee.fecha_retiro.substring(0, 10) : '',
    motivo_retiro: employee?.motivo_retiro || '',
    jornada: employee?.jornada || '',
    departamento: employee?.departamento || '',
    position: employee?.position || '',
    correo_personal: employee?.correo_personal || '',
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const cp = { ...payload };
      ['fecha_ingreso', 'fecha_retiro'].forEach(f => { if (cp[f] === '') cp[f] = null; });
      return api.patch(`/employees/${employee.id}`, cp);
    },
    onSuccess: () => { toast.success('Datos laborales actualizados'); qc.invalidateQueries({ queryKey: ['employees'] }); onSuccess?.(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const handleSubmit = (e) => { e.preventDefault(); mutation.mutate(form); };
  const handleChange = (e) => { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })); };
  const lbl = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={lbl}>Cargo / Posicion</label>
          <select name="position" className="input" style={{ width: '100%' }} value={form.position} onChange={handleChange}>
            <option value="Administrativo">Administrativo</option>
            <option value="Operario">Operario</option>
            <option value="Tecnico">Tecnico</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Tipo de Contrato</label>
          <select name="tipo_contrato" className="input" style={{ width: '100%' }} value={form.tipo_contrato} onChange={handleChange}>
            <option value="">Seleccionar...</option>
            {TIPOS_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={lbl}>Fecha de Ingreso</label>
          <input type="date" name="fecha_ingreso" className="input" style={{ width: '100%' }} value={form.fecha_ingreso} onChange={handleChange} />
        </div>
        {(form.fecha_retiro || employee?.status === 'Inactivo') && (
          <div>
            <label style={lbl}>Fecha de Retiro</label>
            <input type="date" name="fecha_retiro" className="input" style={{ width: '100%' }} value={form.fecha_retiro} onChange={handleChange} />
          </div>
        )}
      </div>
      {isRRHH && (
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '1rem' }}>
          <label style={{ ...lbl, color: '#ef4444' }}>Salario Base (Solo RRHH/Gerencia)</label>
          <input type="number" name="salario" className="input" style={{ width: '100%' }} value={form.salario} onChange={handleChange} />
          <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Este campo solo es visible para roles de RRHH y Gerencia.</p>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={lbl}>Departamento / Area</label>
          <input name="departamento" className="input" style={{ width: '100%' }} value={form.departamento} onChange={handleChange} />
        </div>
        <div>
          <label style={lbl}>Jornada</label>
          <input name="jornada" className="input" style={{ width: '100%' }} value={form.jornada} onChange={handleChange} placeholder="Ej: Completa, Medio tiempo..." />
        </div>
      </div>
      {(form.fecha_retiro || employee?.status === 'Inactivo') && (
        <div>
          <label style={lbl}>Motivo de Retiro</label>
          <input name="motivo_retiro" className="input" style={{ width: '100%' }} value={form.motivo_retiro} onChange={handleChange} />
        </div>
      )}
      <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '1rem' }}>
        <label style={{ ...lbl, color: 'var(--clr-primary-500)' }}>Correo Personal *</label>
        <input type="email" name="correo_personal" className="input" style={{ width: '100%' }} value={form.correo_personal} onChange={handleChange} placeholder="correo@personal.com" />
        {!form.correo_personal && <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '0.25rem' }}>⚠️ Sin correo personal — el empleado no podrá usar el portal público de certificados.</p>}
        {form.correo_personal && <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Se enviará un código OTP a este correo en el portal público de certificados.</p>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}
