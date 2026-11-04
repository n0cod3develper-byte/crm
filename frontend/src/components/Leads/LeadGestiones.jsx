import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PhoneCall, Users, Mail, MessageSquare, ClipboardList,
  Plus, Loader2, AlertCircle, CalendarClock, CheckCircle2,
} from 'lucide-react';
import api from '../../lib/api';
import { fetchAsignables } from '../../lib/leads';
import { usePermissions } from '../../contexts/PermissionsContext';
import { TIPOS_GESTION } from '../../constants/leads';

/** Icono por tipo de gestión (misma tabla que usa el backend). */
const ICONOS = {
  llamada: PhoneCall,
  reunion: Users,
  correo: Mail,
  observacion: MessageSquare,
  otro: ClipboardList,
};

/** Colores suaves por tipo, para distinguirlos de un vistazo en la lista. */
const COLORES = {
  llamada: { bg: '#ecfdf5', color: '#047857' },
  reunion: { bg: '#eff6ff', color: '#1d4ed8' },
  correo: { bg: '#fefce8', color: '#a16207' },
  observacion: { bg: '#f5f3ff', color: '#6d28d9' },
  otro: { bg: '#f1f5f9', color: '#475569' },
};

const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
});

/** "2026-10-19T12:00" (datetime-local) → ISO para el backend. */
const aISO = (valorLocal) => (valorLocal ? new Date(valorLocal).toISOString() : undefined);

export function LeadGestiones({ leadId, leadArchivado }) {
  const { puede } = usePermissions();
  const queryClient = useQueryClient();

  const [filtroTipo, setFiltroTipo] = React.useState('');
  const [mostrarForm, setMostrarForm] = React.useState(false);

  const puedeVer = puede('leads', 'ver');
  const puedeCrear = puede('leads', 'crear');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lead-gestiones', leadId, filtroTipo],
    queryFn: async () => {
      const params = filtroTipo ? `?tipo=${filtroTipo}` : '';
      const { data } = await api.get(`/leads/${leadId}/gestiones${params}`);
      return data;
    },
    enabled: puedeVer,
  });

  const { data: empleadosData } = useQuery({
    queryKey: ['leads-asignables'],
    queryFn: fetchAsignables,
    enabled: puedeCrear && !leadArchivado && mostrarForm,
  });

  const crear = useMutation({
    mutationFn: async (body) => {
      const { data } = await api.post(`/leads/${leadId}/gestiones`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-gestiones', leadId] });
      // La última gestión comercial vive en el resumen del ciclo de vida
      queryClient.invalidateQueries({ queryKey: ['lead-summary', leadId] });
      // Y aparece también en la línea de tiempo del historial
      queryClient.invalidateQueries({ queryKey: ['lead-history', leadId] });
      setMostrarForm(false);
    },
  });

  const gestiones = data?.data || [];
  const empleados = Array.isArray(empleadosData) ? empleadosData : [];

  const mostrarBotonCrear = puedeCrear && !leadArchivado;

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* ── Cabecera: recuento, filtro y alta ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        flexWrap: 'wrap', marginBottom: '1rem',
      }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {isLoading ? 'Cargando…' : `${gestiones.length} gestión${gestiones.length === 1 ? '' : 'es'} registrada${gestiones.length === 1 ? '' : 's'}`}
        </span>

        <select
          className="input"
          style={{ width: 'auto', marginLeft: 'auto' }}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {TIPOS_GESTION.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {mostrarBotonCrear && (
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setMostrarForm((v) => !v)}
          >
            <Plus size={15} /> Registrar gestión
          </button>
        )}
      </div>

      {/* ── Formulario de alta ── */}
      {mostrarForm && (
        <FormGestion
          empleados={empleados}
          mutation={crear}
          onCancel={() => setMostrarForm(false)}
        />
      )}

      {/* ── Estado: archivado, error, vacío ── */}
      {leadArchivado && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
          Este lead está archivado: no admite gestiones nuevas. Restáuralo para seguir
          gestionándolo. Su historial de gestiones se conserva completo.
        </p>
      )}

      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', padding: '0.75rem 0' }}>
          <AlertCircle size={16} /> No fue posible cargar las gestiones.
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando gestiones…
        </div>
      )}

      {!isLoading && !isError && gestiones.length === 0 && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
          {filtroTipo
            ? 'No hay gestiones de ese tipo para este lead.'
            : 'Sin gestión registrada todavía.'}
        </p>
      )}

      {/* ── Lista ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {gestiones.map((g) => {
          const Icon = ICONOS[g.tipo] || ClipboardList;
          const color = COLORES[g.tipo] || COLORES.otro;
          return (
            <div key={g.id} style={{
              border: '1px solid var(--border-color)', borderRadius: '8px',
              padding: '0.85rem', display: 'flex', gap: '0.75rem',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
                background: color.bg, color: color.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={17} />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  display: 'flex', gap: '0.5rem', alignItems: 'baseline',
                  flexWrap: 'wrap', marginBottom: '0.25rem',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {g.etiquetaTipo}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {fmtFecha.format(new Date(g.fechaGestion))}
                  </span>
                  {g.empleado && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      · {g.empleado}
                    </span>
                  )}
                </div>

                {g.observaciones && (
                  <p style={{ fontSize: 'var(--text-sm)', marginBottom: '0.35rem', wordBreak: 'break-word' }}>
                    {g.observaciones}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: 'var(--text-xs)' }}>
                  {g.resultado && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={13} /> Resultado: <strong>{g.resultado}</strong>
                    </span>
                  )}
                  {g.proximaSeguimiento && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#a16207' }}>
                      <CalendarClock size={13} />
                      Próximo seguimiento: {fmtFecha.format(new Date(g.proximaSeguimiento))}
                    </span>
                  )}
                  {g.creadoPor && (
                    <span style={{ color: 'var(--text-muted)' }}>Registrada por {g.creadoPor}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormGestion({ empleados, mutation, onCancel }) {
  const [form, setForm] = React.useState({
    tipo: 'llamada',
    observaciones: '',
    resultado: '',
    fecha_gestion: '',
    proxima_seguimiento: '',
    employee_id: '',
  });

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const enviar = (e) => {
    e.preventDefault();
    mutation.mutate({
      tipo: form.tipo,
      observaciones: form.observaciones.trim() || undefined,
      resultado: form.resultado.trim() || undefined,
      fecha_gestion: aISO(form.fecha_gestion),
      proxima_seguimiento: aISO(form.proxima_seguimiento),
      employee_id: form.employee_id || undefined,
    });
  };

  const error = mutation.error?.response?.data?.error;

  return (
    <form onSubmit={enviar} style={{
      border: '1px solid var(--border-color)', borderRadius: '8px',
      padding: '1rem', marginBottom: '1rem', background: 'var(--bg-elevated)',
    }}>
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Tipo de gestión</label>
          <select className="input" value={form.tipo} onChange={set('tipo')}>
            {TIPOS_GESTION.map((t) => (
              <option key={t} value={t}>
                {t === 'llamada' ? 'Llamada'
                  : t === 'reunion' ? 'Reunión'
                  : t === 'correo' ? 'Correo de seguimiento'
                  : t === 'observacion' ? 'Observación'
                  : 'Otra gestión'}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Empleado que la realizó</label>
          <select className="input" value={form.employee_id} onChange={set('employee_id')}>
            <option value="">— Sin asignar —</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Observaciones</label>
        <textarea
          className="input" rows={3}
          placeholder="Qué se habló, acuerdos, detalles…"
          value={form.observaciones} onChange={set('observaciones')}
        />
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Resultado</label>
          <input
            className="input" placeholder="Pidió cotización, Interesado, Sin respuesta…"
            value={form.resultado} onChange={set('resultado')}
          />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Fecha y hora de la gestión</label>
          <input
            className="input" type="datetime-local"
            value={form.fecha_gestion} onChange={set('fecha_gestion')}
          />
          <span className="input-hint" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Vacío = ahora
          </span>
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Próxima fecha de seguimiento (opcional)</label>
        <input
          className="input" type="datetime-local"
          value={form.proxima_seguimiento} onChange={set('proxima_seguimiento')}
        />
      </div>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
          {error.message || 'No fue posible registrar la gestión.'}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          Guardar gestión
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
