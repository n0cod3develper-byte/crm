import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, DollarSign, CheckSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import api from '../../lib/api';

function KpiCard({ label, value, delta, deltaType, icon: Icon, color }) {
  const isUp = deltaType === 'up';
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="kpi-label">{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={`kpi-delta kpi-delta--${deltaType}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {delta}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ item }) {
  const typeColors = {
    email: '#60a5fa', call: '#4ade80', whatsapp: '#86efac',
    meeting: '#a78bfa', note: '#94a3b8',
  };
  return (
    <div style={{
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
        background: typeColors[item.type] || 'var(--text-muted)',
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          {item.subject || item.title || 'Actividad'}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          {item.created_by_name} · {new Date(item.date || item.created_at).toLocaleDateString('es-CO')}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  // Por ahora mostramos datos de ejemplo hasta que el backend esté conectado
  const kpis = [
    { label: 'Oportunidades activas', value: '24', delta: '+3 esta semana', deltaType: 'up',   icon: TrendingUp,  color: '#6366f1' },
    { label: 'Empresas registradas',  value: '187', delta: '+12 este mes',  deltaType: 'up',   icon: Users,       color: '#22c55e' },
    { label: 'Pipeline total',        value: '$48.2M', delta: '+8.4%',      deltaType: 'up',   icon: DollarSign,  color: '#f59e0b' },
    { label: 'Tareas vencidas',       value: '7',   delta: '-2 vs ayer',    deltaType: 'down', icon: CheckSquare, color: '#ef4444' },
  ];

  return (
    <div className="app-layout">
      <Sidebar />

      {/* Header */}
      <header className="header">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Dashboard</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge badge--primary">Sistema activo</span>
        </div>
      </header>

      {/* Content */}
      <main className="main-content">

        {/* KPIs */}
        <div className="kpi-grid mb-6">
          {kpis.map(k => <KpiCard key={k.label} {...k} />)}
        </div>

        {/* Dos columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>

          {/* Pipeline por etapa */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1.25rem' }}>
              Pipeline por etapa
            </h2>
            {[
              { name: 'Prospecto',   count: 8, value: '$12.4M', color: '#94a3b8', pct: 30 },
              { name: 'Calificado',  count: 6, value: '$15.8M', color: '#60a5fa', pct: 45 },
              { name: 'Propuesta',   count: 5, value: '$9.2M',  color: '#a78bfa', pct: 38 },
              { name: 'Negociación', count: 3, value: '$8.6M',  color: '#fb923c', pct: 25 },
              { name: 'Ganado',      count: 2, value: '$2.2M',  color: '#4ade80', pct: 12 },
            ].map(stage => (
              <div key={stage.name} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{stage.name}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {stage.count} oport. · {stage.value}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${stage.pct}%`, background: stage.color,
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Actividad reciente */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '0.75rem' }}>
              Actividad reciente
            </h2>
            {[
              { type: 'call',     subject: 'Llamada con LOGITRANS S.A.S', created_by_name: 'Carlos M.', date: new Date() },
              { type: 'email',    subject: 'Cotización #0042 enviada',     created_by_name: 'Ana P.',    date: new Date(Date.now() - 3600000) },
              { type: 'whatsapp', subject: 'Mensaje de seguimiento',        created_by_name: 'Carlos M.', date: new Date(Date.now() - 7200000) },
              { type: 'meeting',  subject: 'Reunión de cierre Q2',          created_by_name: 'Ana P.',    date: new Date(Date.now() - 86400000) },
              { type: 'note',     subject: 'Nota interna: revisar flete',   created_by_name: 'Tú',        date: new Date(Date.now() - 172800000) },
            ].map((item, i) => <ActivityItem key={i} item={item} />)}
          </div>
        </div>

        {/* Banner de configuración inicial */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(67,56,202,0.1))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🚀 ¡Sistema iniciado correctamente!</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Sprint 1 completo. Levanta Docker para conectar la base de datos y comenzar a registrar datos reales.
            </p>
          </div>
          <a href="https://docs.docker.com" target="_blank" rel="noreferrer">
            <button className="btn btn--primary">Ver instrucciones</button>
          </a>
        </div>
      </main>
    </div>
  );
}
