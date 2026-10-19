import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, History, LayoutDashboard, User, Mail, Phone,
  Building2, Megaphone, FileText, AlertCircle, Loader2,
} from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import { LeadForm } from '../../components/Leads/LeadForm';
import { LeadHistoryTimeline } from '../../components/Leads/LeadHistoryTimeline';
import { LeadLifecycleSummary, ESTADO_LABEL } from '../../components/Leads/LeadLifecycleSummary';
import { STATUS_COLORS } from '../../constants/leads';
import api from '../../lib/api';

const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
});

export function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState('resumen');

  const { data: lead, isLoading, isError, error } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${id}`);
      return data.data;
    },
  });

  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ['lead-summary', id],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${id}/summary`);
      return data.data;
    },
  });

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'historial', label: 'Historial / Trazabilidad', icon: History },
    { id: 'editar', label: 'Editar', icon: Edit2 },
  ];

  if (isLoading) {
    return (
      <div className="app-layout">
        <Topbar title="Lead" subtitle="Cargando…" />
        <main className="main-content" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        </main>
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="app-layout">
        <Topbar title="Lead" subtitle="No encontrado" />
        <main className="main-content">
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <AlertCircle size={24} style={{ color: '#b91c1c', margin: '0 auto 0.75rem' }} />
            <p style={{ marginBottom: '1rem' }}>
              {error?.response?.status === 403
                ? 'No tienes permisos para ver este lead.'
                : 'No fue posible cargar el lead. Puede que haya sido eliminado.'}
            </p>
            <button className="btn btn--secondary" onClick={() => navigate('/leads')}>
              <ArrowLeft size={16} /> Volver al listado
            </button>
          </div>
        </main>
      </div>
    );
  }

  const nombreCompleto = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  const estado = STATUS_COLORS?.[lead.status] || { bg: '#f1f5f9', color: '#475569', label: lead.status };
  const etiquetaEstado = ESTADO_LABEL[lead.status] || estado.label;

  return (
    <div className="app-layout">
      <Topbar
        title={nombreCompleto || 'Lead'}
        subtitle={`Creado el ${fmtFecha.format(new Date(lead.created_at))}`}
        rightContent={
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/leads')}>
            <ArrowLeft size={16} /> Volver
          </button>
        }
      />

      <main className="main-content">
        {/* Cabecera con los indicadores del ciclo de vida */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={{
              background: estado.bg, color: estado.color, padding: '0.2rem 0.65rem',
              borderRadius: '999px', fontSize: 'var(--text-xs)', fontWeight: 700,
            }}>
              {etiquetaEstado}
            </span>
            {lead.assigned_employee_name ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-sm)' }}>
                <User size={14} /> {lead.assigned_employee_name}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Sin asignar</span>
            )}
            {lead.deleted_at && (
              <span style={{
                background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.65rem',
                borderRadius: '999px', fontSize: 'var(--text-xs)', fontWeight: 700,
                border: '1px dashed #94a3b8',
              }}>
                Archivado · no aparece en el listado
              </span>
            )}
          </div>
          <LeadLifecycleSummary resumen={resumen} isLoading={cargandoResumen} />
        </div>

        {/* Pestañas */}
        <div style={{
          display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem',
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 0',
                  borderBottom: `2px solid ${isActive ? 'var(--clr-primary-500)' : 'transparent'}`,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 400, cursor: 'pointer',
                  background: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="card" style={{ minHeight: '400px' }}>
          {activeTab === 'resumen' && <TabResumen lead={lead} />}

          {activeTab === 'historial' && <LeadHistoryTimeline leadId={id} />}

          {activeTab === 'editar' && (
            <LeadForm
              lead={lead}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['lead', id] });
                queryClient.invalidateQueries({ queryKey: ['lead-summary', id] });
                queryClient.invalidateQueries({ queryKey: ['lead-history', id] });
                queryClient.invalidateQueries({ queryKey: ['leads'] });
                setActiveTab('resumen');
              }}
              onCancel={() => setActiveTab('resumen')}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function TabResumen({ lead }) {
  const filas = [
    { icon: User, label: 'Contacto', valor: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() },
    { icon: Building2, label: 'Cliente / Empresa', valor: lead.company_name },
    { icon: Mail, label: 'Correo electrónico', valor: lead.email },
    { icon: Phone, label: 'Teléfono', valor: lead.phone },
    { icon: Megaphone, label: 'Fuente', valor: lead.source },
    { icon: FileText, label: 'Descripción / Requerimiento', valor: lead.notes },
  ];

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {filas.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.label} style={{
            display: 'flex', gap: '1rem', padding: '0.85rem 0',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '6px', flexShrink: 0,
              background: 'var(--bg-elevated)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
            }}>
              <Icon size={15} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{f.label}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: f.valor ? 'var(--text-primary)' : 'var(--text-muted)', wordBreak: 'break-word' }}>
                {f.valor || 'Sin información'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
