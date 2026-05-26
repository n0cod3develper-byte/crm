import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Trash2, AlertTriangle, Calculator, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import {
  getTipoDia, isFestivoColombia,
  calcularMinutosPorTipo, calcularLiquidacion, RECARGOS
} from '../../hooks/useHorasCalc';

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const fmtH = (min) => {
  if (!min) return '0h 0min';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};
const minToH = (min) => Math.round((min / 60) * 100) / 100;

const TIPO_DIA_LABEL = {
  LUN_VIE: 'Lunes – Viernes',
  SAB: 'Sábado',
  DOM_FESTIVO: 'Domingo / Festivo',
};

function OperarioPanel({ operario, remision, onSaved, onDelete, existingLiq, onResult, isSecondOperario }) {
  const defFecha = isSecondOperario
    ? (remision.segundo_fecha_acordada?.split('T')[0] || remision.fecha_servicio?.split('T')[0] || '')
    : (remision.fecha_servicio?.split('T')[0] || '');

  const [fecha, setFecha] = React.useState(
    existingLiq?.fecha_trabajo
      ? existingLiq.fecha_trabajo.split('T')[0]
      : defFecha
  );
  
  const defEntrada = isSecondOperario ? remision.segundo_hora_salida_cargar : remision.hora_salida_cargar;
  const defSalida = isSecondOperario ? remision.segundo_hora_llegada_cargar : remision.hora_llegada_cargar;

  // horaEntrada = hora SALIDA de CARGAR (inicio del trabajo)
  const [horaEntrada, setHoraEntrada] = React.useState(
    existingLiq?.hora_entrada
      ? existingLiq.hora_entrada.substring(0, 5)
      : (defEntrada?.substring(0, 5) || '')
  );
  // horaSalida = hora LLEGADA a CARGAR (fin del trabajo)
  const [horaSalida, setHoraSalida] = React.useState(
    existingLiq?.hora_salida
      ? existingLiq.hora_salida.substring(0, 5)
      : (defSalida?.substring(0, 5) || '')
  );
  // Valor servicio por hora (tomado de la remisión)
  const [valorServicio, setValorServicio] = React.useState(
    existingLiq?.valor_hora_base || parseFloat(remision.valor_hora) || ''
  );
  // Cálculo reactivo: inicio = Salida CARGAR, fin = Llegada CARGAR
  const tipoDia = getTipoDia(fecha);
  const esFestivo = isFestivoColombia(fecha);
  const minutos = calcularMinutosPorTipo(fecha, horaEntrada, horaSalida);
  const liquidacion = calcularLiquidacion(minutos, parseFloat(valorServicio) || 0);

  const minSinOrd = Object.entries(minutos)
    .filter(([k]) => k !== 'min_ord_diurna')
    .reduce((s, [, v]) => s + v, 0);

  // Solo tipos con recargo extra (las horas ordinarias diurnas no se liquidan como extra)
  const tiposConHoras = Object.entries(RECARGOS).filter(([k]) => (minutos[k] || 0) > 0 && k !== 'min_ord_diurna');

  // Notificar total y payload al modal padre
  React.useEffect(() => {
    if (onResult) {
      const isValid = !!(fecha && horaEntrada && horaSalida && parseFloat(valorServicio) > 0);
      const payload = isValid ? {
        empleado_id: operario.empleado_id,
        fecha_trabajo: fecha,
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        salario_mensual: 0,
        valor_hora_base: parseFloat(valorServicio) || 0,
        min_ord_diurna: minutos.min_ord_diurna,
        min_ord_nocturna: 0,
        min_extra_diurna: minutos.min_extra_diurna,
        min_extra_nocturna: 0,
        min_dom_diurna: 0,
        min_dom_nocturna: 0,
        min_extra_dom_diurna: 0,
        min_extra_dom_nocturna: 0,
        val_ord_diurna: liquidacion.val_ord_diurna,
        val_ord_nocturna: 0,
        val_extra_diurna: liquidacion.val_extra_diurna,
        val_extra_nocturna: 0,
        val_dom_diurna: 0,
        val_dom_nocturna: 0,
        val_extra_dom_diurna: 0,
        val_extra_dom_nocturna: 0,
        total_liquidado: liquidacion.total_liquidado,
      } : null;
      onResult(operario.empleado_id, liquidacion.total_liquidado || 0, payload);
    }
  }, [fecha, horaEntrada, horaSalida, valorServicio, liquidacion.total_liquidado]);

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', background: 'var(--bg-surface)' }}>
      {/* Cabecera operario */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{operario.full_name}</span>
          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: 'var(--clr-primary-400)', fontWeight: 600 }}>
            {operario.position || 'Operario'}
          </span>
          {esFestivo && (
            <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 600 }}>
              🔴 FESTIVO
            </span>
          )}
          {tipoDia && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              {TIPO_DIA_LABEL[tipoDia]}
            </span>
          )}
        </div>
        {existingLiq && (
          <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} onClick={() => onDelete(existingLiq.id, () => {
            setHoraEntrada('');
            setHoraSalida('');
          })}>
            <Trash2 size={13} /> Eliminar
          </button>
        )}
      </div>

      {/* Información del operario */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fecha</label>
          <input type="date" className="input" style={{ width: '100%' }} value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Salida CARGAR (inicio)</label>
          <input type="time" className="input" style={{ width: '100%' }} value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Llegada CARGAR (fin)</label>
          <input type="time" className="input" style={{ width: '100%' }} value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Valor Servicio por Hora (COP)
            {parseFloat(remision.valor_hora) > 0 ? (
              <span style={{ color: 'var(--clr-primary-400)', marginLeft: 4 }} title="Traído de la remisión">✓</span>
            ) : (
              <span style={{ color: 'var(--clr-danger)', marginLeft: 4 }} title="Falta valor de servicio en la remisión">⚠️</span>
            )}
          </label>
          <input type="number" min={0} className="input" style={{ width: '100%' }} value={valorServicio} onChange={e => setValorServicio(e.target.value)} placeholder="Ej: 85000" />
        </div>
      </div>

      {minSinOrd > 0 && parseFloat(valorServicio) > 0 && (
        <>
          {/* Liquidación — solo horas con recargo extra */}
          <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(99,102,241,0.04))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
              <Calculator size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Liquidación de Horas Extras
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.5fr 1fr 1fr 1fr', gap: '0.3rem 0.5rem', fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de Hora</span>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>%</span>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Horas</span>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Vr/Servicio</span>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Subtotal</span>
              {tiposConHoras.map(([key, { label, pct }]) => {
                const min = minutos[key] || 0;
                const horas = minToH(min);
                const vrServicio = liquidacion.valor_hora_base * (pct / 100);
                const subtotal = liquidacion[key.replace('min_', 'val_')] || 0;
                return (
                  <React.Fragment key={key}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ textAlign: 'center', fontWeight: 600 }}>{pct}%</span>
                    <span style={{ textAlign: 'right' }}>{horas}h</span>
                    <span style={{ textAlign: 'right' }}>{fmt(vrServicio)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(subtotal)}</span>
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(34,197,94,0.3)', paddingTop: '0.6rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total horas extras</span>
              <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmtH(minSinOrd)}</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>TOTAL HORAS EXTRAS</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e', textAlign: 'right' }}>{fmt(liquidacion.total_liquidado)}</span>
            </div>
          </div>
        </>
      )}

      {!horaEntrada || !horaSalida ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
          <AlertTriangle size={13} /> Ingresa hora entrada y salida para calcular
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Modal principal
// ──────────────────────────────────────────────────────────────────
export function LiquidacionHorasModal({ remision, onClose }) {
  const qc = useQueryClient();
  // totales en tiempo real por operario (antes de guardar)
  const [totalesRT, setTotalesRT] = React.useState({});
  const [payloadsRT, setPayloadsRT] = React.useState({});
  const [savingAll, setSavingAll] = React.useState(false);

  const { data: horasGuardadas = [] } = useQuery({
    queryKey: ['horas-laborales', remision.id],
    queryFn: async () => { const { data } = await api.get(`/servicios/${remision.id}/horas-laborales`); return data.data || []; },
  });

  const deleteMut = useMutation({
    mutationFn: (hid) => api.delete(`/servicios/${remision.id}/horas-laborales/${hid}`),
    onSuccess: () => { toast.success('Liquidación eliminada'); qc.invalidateQueries({ queryKey: ['horas-laborales', remision.id] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  const operarios = remision.operarios || [];
  const totalGeneral = horasGuardadas.reduce((s, h) => s + parseFloat(h.total_liquidado || 0), 0);
  const totalRT = Object.values(totalesRT).reduce((s, v) => s + v, 0);

  const handleSaved = () => qc.invalidateQueries({ queryKey: ['horas-laborales', remision.id] });
  const handleResult = (empId, total, payload) => {
    setTotalesRT(prev => ({ ...prev, [empId]: total }));
    setPayloadsRT(prev => ({ ...prev, [empId]: payload }));
  };

  const handleSaveAll = async () => {
    const validPayloads = Object.values(payloadsRT).filter(Boolean);
    if (validPayloads.length === 0) {
      toast.error('No hay liquidaciones válidas para guardar');
      return;
    }

    setSavingAll(true);
    try {
      // Sincronizar las horas de ambos operarios con la remisión
      const payload1 = validPayloads.find(p => p.empleado_id === operarios[0]?.empleado_id);
      const payload2 = validPayloads.find(p => p.empleado_id === operarios[1]?.empleado_id);
      
      const totalLiquidacion = validPayloads.reduce((s, p) => s + (p.total_liquidado || 0), 0);
      let patchData = {};

      if (payload1) {
        patchData.hora_salida_cargar = payload1.hora_entrada;
        patchData.hora_llegada_cargar = payload1.hora_salida;
      }
      if (payload2) {
        patchData.segundo_hora_salida_cargar = payload2.hora_entrada;
        patchData.segundo_hora_llegada_cargar = payload2.hora_salida;
      }

      // Calcular cantidad de horas basándose en el primer operario disponible (por defecto el primero)
      const pForCalc = payload1 || payload2;
      let cantidadHoras = 1;
      if (pForCalc && pForCalc.hora_entrada && pForCalc.hora_salida) {
        const dSalida = new Date(`1970-01-01T${pForCalc.hora_entrada}:00`);
        const dLlegada = new Date(`1970-01-01T${pForCalc.hora_salida}:00`);
        if (dLlegada < dSalida) dLlegada.setDate(dLlegada.getDate() + 1);
        const diffHrs = (dLlegada - dSalida) / (1000 * 60 * 60);
        cantidadHoras = parseFloat(diffHrs.toFixed(2)) || 1;
        if (cantidadHoras < 1) cantidadHoras = 1;
      }

      const valorHora = parseFloat(remision.valor_hora || 0);
      const bruto = cantidadHoras * valorHora;
      const iva = bruto * (parseFloat(remision.iva_pct || 19) / 100);
      const neto = bruto + iva - parseFloat(remision.descuentos || 0) + totalLiquidacion;

      patchData.cantidad_horas = cantidadHoras;
      patchData.total_bruto = Math.round(bruto);
      patchData.iva_valor = Math.round(iva);
      patchData.total_neto = Math.round(neto);

      await api.put(`/servicios/${remision.id}`, patchData);

      // 2. Guardar las liquidaciones
      await Promise.all(validPayloads.map(payload => 
        api.post(`/servicios/${remision.id}/horas-laborales`, payload)
      ));
      
      toast.success('Todas las liquidaciones y la remisión guardadas');
      qc.invalidateQueries({ queryKey: ['horas-laborales', remision.id] });
      qc.invalidateQueries({ queryKey: ['servicios', remision.id] }); // Para actualizar Detalle de Remisión
      qc.invalidateQueries({ queryKey: ['servicios-edit', remision.id] });
      onClose(); // Auto-cerrar modal después de guardar todo
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al guardar liquidaciones');
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '2rem 1rem' }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 900, boxShadow: '0 25px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>⏱️ Horas Extras</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Remisión {remision.numero_remision} — {remision.empresa_nombre}</p>
          </div>
          <button className="btn btn--ghost" style={{ padding: '0.25rem' }} onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Sin operarios */}
          {operarios.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <AlertTriangle size={32} style={{ marginBottom: 8 }} />
              <p>Esta remisión no tiene operarios asignados.<br />Asigna operarios desde la página de detalle para liquidar sus horas.</p>
            </div>
          )}

          {/* Panel por operario */}
          {operarios.map((op, idx) => {
            const liqExistente = horasGuardadas.find(h => h.empleado_id === op.empleado_id);
            return (
              <OperarioPanel
                key={op.empleado_id}
                operario={op}
                remision={remision}
                existingLiq={liqExistente || null}
                isSecondOperario={idx === 1}
                onSaved={handleSaved}
                onResult={handleResult}
                onDelete={(hid, cb) => { 
                  if (window.confirm('¿Eliminar esta liquidación?')) {
                    deleteMut.mutate(hid, { onSuccess: () => { cb && cb(); } });
                  } 
                }}
              />
            );
          })}

          {/* Total general en tiempo real (todos los operarios) */}
          {operarios.length > 0 && totalRT > 0 && (
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(34,197,94,0.08))', border: '2px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '1rem 1.25rem', marginTop: '0.5rem' }}>
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: '0.75rem' }}>📊 Total General Horas Extras</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem', fontSize: 13 }}>
                {operarios.map(op => {
                  const t = totalesRT[op.empleado_id] || 0;
                  return t > 0 ? (
                    <React.Fragment key={op.empleado_id}>
                      <span style={{ color: 'var(--text-secondary)' }}>{op.full_name}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{fmt(t)}</span>
                    </React.Fragment>
                  ) : null;
                })}
                <span style={{ fontWeight: 800, fontSize: 15, borderTop: '2px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>TOTAL HORAS EXTRAS</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#22c55e', textAlign: 'right', borderTop: '2px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  {fmt(totalRT)}
                </span>
              </div>
            </div>
          )}

          {/* Cierre y Guardar Todo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            {operarios.length > 0 && (
              <button 
                className="btn btn--primary" 
                onClick={handleSaveAll}
                disabled={savingAll || Object.values(payloadsRT).filter(Boolean).length === 0}
                style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}
              >
                <Save size={16} style={{ marginRight: 6 }} />
                {savingAll ? 'Guardando...' : 'Guardar Horas Extras'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
