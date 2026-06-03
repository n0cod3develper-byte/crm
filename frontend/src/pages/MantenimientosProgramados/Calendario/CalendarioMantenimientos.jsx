import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import { EstadoBadge } from '../../../components/MantenimientosProgramados/EstadoBadge';
import toast from 'react-hot-toast';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export default function CalendarioMantenimientos() {
  const navigate = useNavigate();
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCalendario = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mpService.getCalendario(year, month);
      setOrdenes(res.data?.data || []);
    } catch (err) { toast.error('Error al cargar calendario'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { loadCalendario(); }, [loadCalendario]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  const ordenesPorFecha = {};
  ordenes.forEach(o => {
    const fecha = o.fecha_programada?.split('T')[0];
    if (fecha) { if (!ordenesPorFecha[fecha]) ordenesPorFecha[fecha] = []; ordenesPorFecha[fecha].push(o); }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Calendario de Mantenimientos</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Vista mensual de órdenes programadas</p>
      </div>

      {/* Navegación */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
        <button onClick={prevMonth} className="btn btn--ghost"><ChevronLeft size={20} /></button>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarDays size={20} color="var(--clr-primary-400)" />
          {MESES[month - 1]} {year}
        </h3>
        <button onClick={nextMonth} className="btn btn--ghost"><ChevronRight size={20} /></button>
      </div>

      {/* Calendario */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Días de la semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
          {DIAS.map(d => (
            <div key={d} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-elevated)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: '100px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', opacity: 0.5 }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const dayOrdenes = ordenesPorFecha[dateStr] || [];

            return (
              <div key={day} style={{
                minHeight: '100px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)',
                padding: '0.25rem', background: isToday ? 'rgba(37,99,235,0.05)' : 'var(--bg-surface)',
              }}>
                <div style={{
                  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                  fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '0.25rem',
                  background: isToday ? 'var(--clr-primary-500)' : 'transparent',
                  color: isToday ? 'white' : 'var(--text-secondary)',
                }}>
                  {day}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  {dayOrdenes.slice(0, 3).map(o => {
                    const stateColors = {
                      PROGRAMADO: { bg: 'rgba(37,99,235,0.1)', color: '#3b82f6' },
                      EN_EJECUCION: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
                      COMPLETADO: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
                      VERIFICADO: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
                      CANCELADO: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
                    };
                    const sc = stateColors[o.estado] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
                    return (
                      <div key={o.id}
                        onClick={() => navigate(`/mantenimientos-programados/ordenes/${o.id}`)}
                        style={{ cursor: 'pointer', fontSize: '10px', padding: '1px 4px', borderRadius: '4px', background: sc.bg, color: sc.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={`${o.codigo} - ${o.titulo}`}>
                        <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{o.codigo}</code>
                      </div>
                    );
                  })}
                  {dayOrdenes.length > 3 && (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '0.25rem' }}>+{dayOrdenes.length - 3} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
