import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Lock, Trash2, MessageCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';

const STATUS_COLOR = {
  open:        { bg: '#3b82f620', tx: '#60a5fa' },
  in_progress: { bg: '#f97316' + '20', tx: '#f97316' },
  waiting:     { bg: '#eab30820', tx: '#eab308' },
  resolved:    { bg: '#22c55e20', tx: '#22c55e' },
  closed:      { bg: '#94a3b820', tx: '#94a3b8' },
};
const STATUS_LABEL = { open: 'Abierto', in_progress: 'En progreso', waiting: 'En espera', resolved: 'Resuelto', closed: 'Cerrado' };
const PRIORITY_COLOR = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#94a3b8' };
const PRIORITY_LABEL = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };

function Avatar({ name, url, size = 32 }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4,
      background: 'var(--clr-primary-500)', color: 'white',
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function MessageBubble({ msg, currentUserId, onDelete }) {
  const isMe = msg.created_by === currentUserId;
  const time = new Date(msg.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', gap: '0.625rem', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <Avatar name={msg.author_name} url={msg.author_avatar} size={28} />
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexDirection: isMe ? 'row-reverse' : 'row' }}>
          <span style={{ fontWeight: 600 }}>{msg.author_name || 'Agente'}</span>
          <span>{time}</span>
          {msg.is_internal && (
            <span title="Nota interna" style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#a78bfa' }}>
              <Lock size={10} /> Interna
            </span>
          )}
        </div>
        <div style={{
          padding: '0.625rem 0.875rem',
          borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
          background: msg.is_internal
            ? 'rgba(167,139,250,0.12)'
            : isMe ? 'var(--clr-primary-500)' : 'var(--bg-elevated)',
          color: isMe && !msg.is_internal ? 'white' : 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.5,
          border: msg.is_internal ? '1px dashed #a78bfa60' : '1px solid var(--border-color)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.body}
        </div>
        {isMe && (
          <button
            onClick={() => onDelete(msg.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px' }}
            title="Eliminar mensaje"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function TicketDetail({ ticket, onClose }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [body, setBody] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(false);
  const bottomRef = React.useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ticket-messages', ticket.id],
    queryFn: async () => {
      const { data } = await api.get(`/support/${ticket.id}/messages`);
      return data;
    },
    refetchInterval: 30_000,
  });

  const messages = data?.data || [];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/support/${ticket.id}/messages`, { body: body.trim(), is_internal: isInternal }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['ticket-messages', ticket.id] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar'),
  });

  const deleteMsgMutation = useMutation({
    mutationFn: (msgId) => api.delete(`/support/${ticket.id}/messages/${msgId}`),
    onSuccess: () => {
      toast.success('Mensaje eliminado');
      qc.invalidateQueries({ queryKey: ['ticket-messages', ticket.id] });
    },
  });

  function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    sendMutation.mutate();
  }

  const stc = STATUS_COLOR[ticket.status] || STATUS_COLOR.open;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-elevated)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              #{ticket.ticket_number}
            </span>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 9999, fontWeight: 700, background: stc.bg, color: stc.tx }}>
              {STATUS_LABEL[ticket.status]}
            </span>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 9999, fontWeight: 700, background: `${PRIORITY_COLOR[ticket.priority]}20`, color: PRIORITY_COLOR[ticket.priority] }}>
              {PRIORITY_LABEL[ticket.priority]}
            </span>
          </div>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1.3 }}>{ticket.title}</h3>
          {(ticket.company_name || ticket.assigned_to_name) && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {[ticket.company_name, ticket.assigned_to_name && `Asignado: ${ticket.assigned_to_name}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ padding: '0.25rem', flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>

      {/* Descripción inicial */}
      {ticket.description && (
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>DESCRIPCIÓN</p>
          <p style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.description}</p>
        </div>
      )}

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
            <MessageCircle size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
            <p style={{ fontSize: 'var(--text-sm)' }}>Sin mensajes aún. Sé el primero en responder.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              currentUserId={user?.id}
              onDelete={(id) => deleteMsgMutation.mutate(id)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Área de respuesta */}
      <form onSubmit={handleSend} style={{
        borderTop: '1px solid var(--border-color)',
        padding: '0.875rem 1.25rem',
        background: 'var(--bg-elevated)',
        display: 'flex', flexDirection: 'column', gap: '0.625rem',
      }}>
        <textarea
          id="ticket-reply-body"
          className="input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe una respuesta…"
          rows={3}
          style={{ resize: 'none' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(e);
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--text-xs)', color: isInternal ? '#a78bfa' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              style={{ accentColor: '#a78bfa' }}
            />
            <Lock size={12} />
            Nota interna
          </label>
          <button
            id="ticket-reply-send"
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={!body.trim() || sendMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Send size={13} />
            {sendMutation.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
