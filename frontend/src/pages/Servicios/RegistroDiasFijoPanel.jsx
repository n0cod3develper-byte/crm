import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, Clock, DollarSign, AlertCircle, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

const fmtCOP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const parseTime = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
const pad = (n) => String(n).padStart(2, '0');

export function RegistroDiasFijoPanel({ remision }) {
  const qc = useQueryClient();
  const operarios = remision.operarios || [];
  
  const { data: diasRegistrados = [], isLoading } = useQuery({
    queryKey: ['dias-fijo', remision.id],
    queryFn: async () => {
      const { data } = await api.get(`/servicios/${remision.id}/dias-fijo`);
      return data.data || [];
    },
    enabled: !!remision.id,
  });

  const upsertMutation = useMutation({
    mutationFn: (payload) => api.post(`/servicios/${remision.id}/dias-fijo`, payload),
    onSuccess: () => {
      toast.success('Día registrado');
      qc.invalidateQueries({ queryKey: ['dias-fijo', remision.id] });
      // Reset form
      setHoraEntrada('');
      setHoraSalida('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (did) => api.delete(`/servicios/${remision.id}/dias-fijo/${did}`),
    onSuccess: () => {
      toast.success('Registro eliminado');
      qc.invalidateQueries({ queryKey: ['dias-fijo', remision.id] });
    },
    onError: (err) => toast.error('Error al eliminar'),
  });

  const bonificacionBase = parseFloat(remision.equipo_bonificacion_hora || remision.bonificacion_hora || 0);

  // Form State
  const [empleadoId, setEmpleadoId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSalida, setHoraSalida] = useState('');
  const [descDesayuno, setDescDesayuno] = useState(true);
  const [descAlmuerzo, setDescAlmuerzo] = useState(false);

  // Calculate live preview
  let prevHorasBrutas = 0;
  let prevMinDesc = 0;
  let prevHorasNetas = 0;
  let prevComision = 0;

  if (horaEntrada && horaSalida) {
    let minEntrada = parseTime(horaEntrada);
    let minSalida = parseTime(horaSalida);
    let diff = minSalida - minEntrada;
    if (diff < 0) diff += 24 * 60; // cruce medianoche

    prevHorasBrutas = diff / 60;
    prevMinDesc = (descDesayuno ? 20 : 0) + (descAlmuerzo ? 30 : 0);
    prevHorasNetas = Math.max(0, prevHorasBrutas - prevMinDesc / 60);
    prevComision = prevHorasNetas * bonificacionBase;
  }

  useEffect(() => {
    if (operarios.length > 0 && !empleadoId) {
      setEmpleadoId(operarios[0].empleado_id);
    }
  }, [operarios, empleadoId]);

  const handleSave = () => {
    if (!empleadoId || !fecha || !horaEntrada || !horaSalida) {
      toast.error('Complete todos los campos obligatorios');
      return;
    }
    upsertMutation.mutate({
      empleado_id: empleadoId,
      fecha,
      hora_entrada: horaEntrada,
      hora_salida: horaSalida,
      descuento_desayuno: descDesayuno,
      descuento_almuerzo: descAlmuerzo,
      bonificacion_hora: bonificacionBase
    });
  };

  // Group by Quincena
  const quincenas = {};
  diasRegistrados.forEach(dia => {
    const d = new Date(dia.fecha + 'T12:00:00Z');
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const qName = day <= 15 ? `Q1 (01-15) ${pad(m)}/${y}` : `Q2 (16-Fin) ${pad(m)}/${y}`;
    const sortKey = `${y}-${pad(m)}-${day <= 15 ? '1' : '2'}`;
    
    if (!quincenas[sortKey]) quincenas[sortKey] = { label: qName, dias: [], totalHoras: 0, totalComision: 0 };
    quincenas[sortKey].dias.push(dia);
    quincenas[sortKey].totalHoras += parseFloat(dia.horas_netas || 0);
    quincenas[sortKey].totalComision += parseFloat(dia.comision || 0);
  });
  
  const sortedQuincenas = Object.entries(quincenas).sort((a,b) => a[0].localeCompare(b[0])).map(v => v[1]);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="var(--clr-primary-500)" />
            Registro de Horas (Servicio Fijo)
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, marginTop: 4 }}>
            Bonificación Base Equipo: <strong style={{ color: 'var(--text-primary)' }}>{fmtCOP(bonificacionBase)} / hr</strong>
          </p>
        </div>
      </div>

      {operarios.length === 0 ? (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>Debe asignar al menos un operario a la remisión para registrar días.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Operario</label>
            <select className="input" style={{ width: '100%', fontSize: 13, padding: '0.4rem 0.5rem' }} value={empleadoId} onChange={e => setEmpleadoId(e.target.value)}>
              {operarios.map(op => (
                <option key={op.empleado_id} value={op.empleado_id}>{op.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fecha</label>
            <input type="date" className="input" style={{ width: '100%', fontSize: 13, padding: '0.4rem 0.5rem' }} value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>H. Entrada</label>
            <input type="time" className="input" style={{ width: '100%', fontSize: 13, padding: '0.4rem 0.5rem' }} value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>H. Salida</label>
            <input type="time" className="input" style={{ width: '100%', fontSize: 13, padding: '0.4rem 0.5rem' }} value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={descDesayuno} onChange={e => setDescDesayuno(e.target.checked)} />
              Desc. Desayuno (20m)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={descAlmuerzo} onChange={e => setDescAlmuerzo(e.target.checked)} />
              Desc. Almuerzo (30m)
            </label>
          </div>

          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Horas Brutas: <strong style={{ color: 'var(--text-primary)' }}>{prevHorasBrutas.toFixed(2)}h</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>Descuento: <strong style={{ color: 'var(--clr-danger)' }}>{prevMinDesc}m</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>Horas Netas: <strong style={{ color: '#22c55e' }}>{prevHorasNetas.toFixed(2)}h</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>Comisión Est: <strong style={{ color: 'var(--clr-primary-500)' }}>{fmtCOP(prevComision)}</strong></span>
            </div>
            <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={upsertMutation.isPending || !horaEntrada || !horaSalida}>
              <Plus size={14} style={{ marginRight: 6 }} /> Agregar Día
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="spinner" style={{ margin: '2rem auto' }} />
      ) : sortedQuincenas.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '2rem 0' }}>No hay días registrados para este servicio.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {sortedQuincenas.map(q => (
            <div key={q.label} style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{q.label}</span>
                <span>{q.dias.length} día(s) registradas</span>
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600 }}>Operario</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600 }}>Fecha</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600 }}>Entrada</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600 }}>Salida</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600 }}>Desc. (m)</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600 }}>Hrs Netas</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600 }}>Comisión</th>
                    <th style={{ padding: '0.5rem 1rem', width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {q.dias.map(dia => (
                    <tr key={dia.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem 1rem' }}>{dia.empleado_nombre}</td>
                      <td style={{ padding: '0.5rem 1rem' }}>{dia.fecha.split('T')[0]}</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>{dia.hora_entrada.substring(0,5)}</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>{dia.hora_salida.substring(0,5)}</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{dia.minutos_descuento}</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600 }}>{parseFloat(dia.horas_netas).toFixed(2)}h</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmtCOP(dia.comision)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button className="btn btn--ghost btn--sm" style={{ padding: '0.2rem', color: 'var(--clr-danger)' }} onClick={() => {
                          if (window.confirm('¿Eliminar registro?')) deleteMutation.mutate(dia.id);
                        }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <td colSpan={5} style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 800 }}>SUBTOTAL {q.label}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 800 }}>{q.totalHoras.toFixed(2)}h</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 800, color: '#22c55e' }}>{fmtCOP(q.totalComision)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
