import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

const TIPOS_CONTRATO = [
  'Termino Indefinido', 'Termino Fijo', 'Obra/Labor',
  'Prestacion de Servicios', 'Aprendizaje', 'Temporal'
];

const TURNOS = ['Dia', 'Noche', 'Mixto'];
const TIPOS_VINCULACION = ['VINCULADO DIRECTO', 'CONTRATISTA'];

/** Calcula antigüedad entre una fecha de ingreso y hoy */
function calcularAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return null;
  const ingreso = new Date(fechaIngreso + 'T00:00:00');
  if (isNaN(ingreso.getTime())) return null;
  const hoy = new Date();
  if (ingreso > hoy) return null;

  let anios = hoy.getFullYear() - ingreso.getFullYear();
  let meses = hoy.getMonth() - ingreso.getMonth();
  let dias = hoy.getDate() - ingreso.getDate();

  if (dias < 0) {
    meses--;
    // Días del mes anterior
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    dias += mesAnterior.getDate();
  }
  if (meses < 0) {
    anios--;
    meses += 12;
  }

  const partes = [];
  if (anios > 0) partes.push(`${anios} año${anios !== 1 ? 's' : ''}`);
  if (meses > 0) partes.push(`${meses} mes${meses !== 1 ? 'es' : ''}`);
  if (dias > 0 || partes.length === 0) partes.push(`${dias} día${dias !== 1 ? 's' : ''}`);
  return partes.join(', ');
}

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
    // Nuevos campos
    tipo_vinculacion: employee?.tipo_vinculacion || '',
    sede: employee?.sede || '',
  });

  const antiguedad = calcularAntiguedad(form.fecha_ingreso);

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
          <label style={lbl}>Cargo / Posición</label>
          <select name="position" className="input" style={{ width: '100%' }} value={form.position} onChange={handleChange}>
            <option value="Administrativo">Administrativo</option>
            <option value="Operario">Operario</option>
            <option value="Tecnico">Técnico</option>
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
          <label style={lbl}>Tipo de Vinculación</label>
          <select name="tipo_vinculacion" className="input" style={{ width: '100%' }} value={form.tipo_vinculacion} onChange={handleChange}>
            <option value="">Seleccionar...</option>
            {TIPOS_VINCULACION.map(tv => <option key={tv} value={tv}>{tv}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Sede</label>
          <input name="sede" className="input" style={{ width: '100%' }} value={form.sede} onChange={handleChange} placeholder="Sede del empleado" />
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

      {/* ─── Antigüedad (calculada dinámicamente) ─── */}
      <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
        <label style={{ ...lbl, color: '#10b981' }}>Antigüedad</label>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          {antiguedad || 'Sin fecha de ingreso registrada'}
        </p>
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
          Calculada automáticamente desde la fecha de ingreso. No se puede editar manualmente.
        </p>
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
          <label style={lbl}>Área de Trabajo</label>
          <input name="departamento" className="input" style={{ width: '100%' }} value={form.departamento} onChange={handleChange} placeholder="Ej: Operaciones, Sistemas..." />
        </div>
        <div>
          <label style={lbl}>Turno</label>
          <select name="jornada" className="input" style={{ width: '100%' }} value={form.jornada} onChange={handleChange}>
            <option value="">Seleccionar...</option>
            {TURNOS.map(t => <option key={t} value={t}>{t === 'Dia' ? 'Día' : t}</option>)}
          </select>
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
