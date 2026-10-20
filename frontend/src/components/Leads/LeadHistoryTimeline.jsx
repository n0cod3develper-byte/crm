import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UserPlus, UserCheck, RefreshCw, Pencil, CheckCircle2,
  ClipboardList, Filter, AlertCircle, Mail, MailWarning,
  RotateCcw, Clock,
} from 'lucide-react';
import api from '../../lib/api';
import { formatearDuracion } from '../../constants/leads';

/** Icono y color por tipo de evento. */
const TIPOS = {
  CREACION:        { icon: UserPlus,    color: '#0284c7', label: 'Creación' },
  ASIGNACION:      { icon: UserCheck,   color: '#7c3aed', label: 'Asignación' },
  CAMBIO_ESTADO:   { icon: RefreshCw,   color: '#d97706', label: 'Cambio de estado' },
  MODIFICACION:    { icon: Pencil,      color: '#0d9488', label: 'Modificación' },
  CIERRE:          { icon: CheckCircle2, color: '#166534', label: 'Cierre' },
  ACTIVIDAD:       { icon: ClipboardList, color: '#4f46e5', label: 'Actividad' },
  RESTAURACION:    { icon: RotateCcw,   color: '#0f766e', label: 'Restauración' },
};

/** Fecha y hora en zona horaria de Colombia. */
const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function LeadHistoryTimeline({ leadId }) {
  const [tipo, setTipo] = React.useState('');
  const [desde, setDesde] = React.useState('');
  const [hasta, setHasta] = React.useState('');
  const [paginas, setPaginas] = React.useState([]);
  const [cursor, setCursor] = React.useState(null);

  // Al cambiar un filtro se reinicia la paginación acumulada
  React.useEffect(() => {
    setPaginas([]);
    setCursor(null);
  }, [leadId, tipo, desde, hasta]);

  const params = React.useMemo(() => {
    const p = {};
    if (tipo) p.tipo = tipo;
    if (desde) p.desde = desde;
    if (hasta) p.hasta = `${hasta}T23:59:59`;
    return p;
  }, [tipo, desde, hasta]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['lead-history', leadId, params, cursor],
    queryFn: async () => {
      const q = { ...params, limit: 25 };
      if (cursor) { q.cursorFecha = cursor.fecha; q.cursorOrden = cursor.orden; }
      const { data } = await api.get(`/leads/${leadId}/history`, { params: q });
      return data;
    },
  });

  // Acumular páginas para la carga progresiva
  React.useEffect(() => {
    if (!data?.data) return;
    setPaginas((prev) => {
      const yaVistas = new Set(prev.flat().map((e) => `${e.fuente}:${e.id}`));
      const nuevas = data.data.filter((e) => !yaVistas.has(`${e.fuente}:${e.id}`));
      return nuevas.length ? [...prev, nuevas] : prev;
    });
  }, [data]);

  const eventos = React.useMemo(() => paginas.flat(), [paginas]);
  const hayMas = Boolean(data?.pagination?.hasMore);

  const cargarMas = () => {
    if (data?.pagination?.nextCursor) setCursor(data.pagination.nextCursor);
  };

  const hayFiltro = Boolean(tipo || desde || hasta);

  return (
    <div>
      {/* ── Filtros ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end',
        padding: '0.75rem 0 1.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
          <Filter size={15} />
          <span style={{ fontSize: 'var(--text-sm)' }}>Filtrar</span>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Tipo de evento</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ minWidth: 190 }}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Desde</span>
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Hasta</span>
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>

        {hayFiltro && (
          <button className="btn btn--ghost btn--sm" onClick={() => { setTipo(''); setDesde(''); setHasta(''); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Estados ─────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando historial…
        </div>
      )}

      {isError && (
        <div style={{
          display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'center',
          padding: '2.5rem', color: '#b91c1c',
        }}>
          <AlertCircle size={18} />
          <span>{error?.response?.data?.error || 'No fue posible cargar el historial.'}</span>
        </div>
      )}

      {!isLoading && !isError && eventos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          {hayFiltro
            ? 'No hay eventos que coincidan con los filtros seleccionados.'
            : 'Este lead todavía no tiene eventos registrados.'}
        </div>
      )}

      {/* ── Línea de tiempo ─────────────────────────────────── */}
      {!isLoading && !isError && eventos.length > 0 && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {eventos.map((ev, idx) => (
            <TimelineItem key={`${ev.fuente}-${ev.id}`} ev={ev} esUltimo={idx === eventos.length - 1} />
          ))}
        </ol>
      )}

      {hayMas && (
        <div style={{ textAlign: 'center', paddingTop: '1.25rem' }}>
          <button className="btn btn--secondary btn--sm" onClick={cargarMas} disabled={isFetching}>
            {isFetching ? 'Cargando…' : 'Cargar eventos anteriores'}
          </button>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ ev, esUltimo }) {
  const def = TIPOS[ev.tipo] || TIPOS.MODIFICACION;
  const Icon = def.icon;
  const fecha = new Date(ev.fecha);

  return (
    <li style={{ display: 'flex', gap: '1rem', position: 'relative', paddingBottom: esUltimo ? 0 : '1.5rem' }}>
      {/* Conector vertical */}
      {!esUltimo && (
        <div style={{
          position: 'absolute', left: 15, top: 34, bottom: 0,
          width: 2, background: 'var(--border-color)',
        }} />
      )}

      {/* Punto del tipo de evento */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, zIndex: 1,
        background: 'var(--bg-elevated)', border: `2px solid ${def.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: def.color,
      }}>
        <Icon size={15} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: def.color }}>
            {def.label}
            {ev.etiquetaCampo ? ` · ${ev.etiquetaCampo}` : ''}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {fmtFecha.format(fecha)}
          </span>
        </div>

        {ev.descripcion && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0.35rem 0 0' }}>
            {ev.descripcion}
          </p>
        )}

        {/* Nota escrita por el usuario (solo cambios de estado manuales) */}
        {ev.nota && (
          <div style={{
            marginTop: '0.5rem', padding: '0.5rem 0.75rem',
            background: 'var(--bg-elevated)', borderLeft: '3px solid #d97706',
            borderRadius: '4px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {ev.nota}
          </div>
        )}

        {/* Duración en el estado (solo eventos que entran a un estado) */}
        {ev.duracionSegundos !== null && ev.duracionSegundos !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            marginTop: '0.4rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
          }}>
            <Clock size={12} />
            <span>
              {ev.duracionConfiable === false
                ? 'Duración no disponible (anterior a la migración)'
                : `${ev.esEstadoActual ? 'En este estado' : 'Duración en el estado'}: ${formatearDuracion(ev.duracionSegundos)}`}
            </span>
          </div>
        )}

        {/* Comparación de valores (solo cuando hay cambio real) */}
        {(ev.valorAnterior !== null || ev.valorNuevo !== null) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            marginTop: '0.5rem', fontSize: 'var(--text-xs)',
          }}>
            {ev.valorAnterior !== null && (
              <span style={{
                background: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.5rem',
                borderRadius: '4px', textDecoration: 'line-through',
              }}>
                {String(ev.valorAnterior)}
              </span>
            )}
            {ev.valorAnterior !== null && ev.valorNuevo !== null && (
              <span style={{ color: 'var(--text-muted)' }}>→</span>
            )}
            {ev.valorNuevo !== null && (
              <span style={{
                background: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '4px',
              }}>
                {String(ev.valorNuevo)}
              </span>
            )}
          </div>
        )}

        {/* Resultado del correo de notificación, cuando está disponible */}
        {ev.metadata?.notificacion_enviada !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginTop: '0.5rem', fontSize: 'var(--text-xs)',
            color: ev.metadata.notificacion_enviada ? '#166534' : '#b45309',
          }}>
            {ev.metadata.notificacion_enviada ? <Mail size={13} /> : <MailWarning size={13} />}
            <span>
              {ev.metadata.notificacion_enviada
                ? 'Notificación por correo enviada'
                : `Correo no enviado${ev.metadata.notificacion_motivo ? ` (${ev.metadata.notificacion_motivo})` : ''}`}
            </span>
          </div>
        )}

        {/* Responsable y usuario */}
        {(ev.usuario || ev.empleado) && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {ev.usuario && <span>Por {ev.usuario}</span>}
            {ev.usuario && ev.empleado && <span> · </span>}
            {ev.empleado && <span>Empleado: {ev.empleado}</span>}
          </div>
        )}
      </div>
    </li>
  );
}
