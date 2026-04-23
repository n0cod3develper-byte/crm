import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Plus, Search, Filter, Eye, Edit, Trash2, FileText,
  ClipboardCheck, Clock, Building2, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import api from '../../lib/api';

const ESTADOS = [
  { value: 'all', label: 'Todos los estados', color: '#64748b' },
  { value: 'ABIERTA', label: 'Abierta', color: '#3b82f6' },
  { value: 'EN_PROCESO', label: 'En proceso', color: '#f59e0b' },
  { value: 'LIQUIDADA', label: 'Liquidada', color: '#22c55e' },
  { value: 'CERRADA', label: 'Cerrada', color: '#64748b' },
];

const TIPOS = [
  { value: 'all', label: 'Todos' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'PREVENTIVO', label: 'Preventivo' },
];

function getEstadoStyle(estado) {
  const map = {
    ABIERTA:   { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    EN_PROCESO:{ bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    LIQUIDADA: { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
    CERRADA:   { bg: 'rgba(100,116,139,0.15)',color: '#94a3b8' },
  };
  return map[estado] || map.CERRADA;
}

export function MantenimientoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [filterEstado, setFilterEstado] = React.useState('all');
  const [filterTipo, setFilterTipo] = React.useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['ordenes-trabajo', search, filterEstado, filterTipo],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterEstado !== 'all') params.estado = filterEstado;
      if (filterTipo !== 'all') params.tipo_mantenimiento = filterTipo;
      const { data } = await api.get('/mantenimiento/ot', { params });
      return data;
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/mantenimiento/ot/${id}`),
    onSuccess: () => { toast.success('OT anulada'); qc.invalidateQueries({ queryKey: ['ordenes-trabajo'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al anular'),
  });

  const ots = data?.data || [];

  // Métricas simples
  const abiertas   = ots.filter(o => o.estado === 'ABIERTA').length;
  const enProceso  = ots.filter(o => o.estado === 'EN_PROCESO').length;
  const liquidadas = ots.filter(o => o.estado === 'LIQUIDADA').length;
  const total      = ots.length;

  return (
    <div className="app-layout">
      <Sidebar />
      <header className="header">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={22} color="var(--clr-primary-400)" /> Mantenimiento
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Órdenes de trabajo — Correctivo y Preventivo
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/mantenimiento/nueva')}>
          <Plus size={16} /> Nueva OT
        </button>
      </header>

      <main className="main-content">
        {/* KPIs */}
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Abiertas', value: abiertas, icon: AlertTriangle, color: '#3b82f6' },
            { label: 'En Proceso', value: enProceso, icon: Clock, color: '#f59e0b' },
            { label: 'Liquidadas', value: liquidadas, icon: ClipboardCheck, color: '#22c55e' },
            { label: 'Total OTs', value: total, icon: FileText, color: 'var(--clr-primary-500)' },
          ].map(kpi => (
            <div key={kpi.label} className="kpi-card" style={{ '--kpi-color': kpi.color }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label">{kpi.label}</span>
                <kpi.icon size={18} color={kpi.color} />
              </div>
              <span className="kpi-value">{kpi.value}</span>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              placeholder="Buscar por consecutivo, empresa o detalle..."
              style={{ paddingLeft: '2.5rem' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : ots.length === 0 ? (
          <div className="empty-state">
            <Wrench size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin órdenes de trabajo</h2>
            <p className="empty-state__desc">Crea tu primera orden de trabajo para comenzar a gestionar el mantenimiento.</p>
            <button className="btn btn--primary" onClick={() => navigate('/mantenimiento/nueva')}>
              <Plus size={16} /> Nueva OT
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Consecutivo</th>
                    <th>Empresa</th>
                    <th>Equipo</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Técnico(s)</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ots.map(ot => {
                    const est = getEstadoStyle(ot.estado);
                    return (
                      <tr key={ot.id}>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--clr-primary-400)', cursor: 'pointer' }} onClick={() => navigate(`/mantenimiento/${ot.id}`)}>
                            {ot.consecutivo}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Building2 size={14} color="var(--text-muted)" />
                            <span style={{ fontWeight: 500 }}>{ot.empresa_nombre}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>{ot.equipo_marca} {ot.equipo_modelo}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ot.equipo_serial}</div>
                        </td>
                        <td>
                          <span className={`badge ${ot.tipo_mantenimiento === 'CORRECTIVO' ? 'badge--warning' : 'badge--primary'}`}>
                            {ot.tipo_mantenimiento}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ background: est.bg, color: est.color }}>
                            {ot.estado.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>
                            {(ot.tecnicos || []).length > 0 ? ot.tecnicos.join(', ') : <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(ot.created_at).toLocaleDateString('es-CO')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/mantenimiento/${ot.id}`)} title="Ver detalle">
                              <Eye size={14} />
                            </button>
                            {(ot.estado === 'ABIERTA' || ot.estado === 'EN_PROCESO') && (
                              <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/mantenimiento/${ot.id}/editar`)} title="Editar">
                                <Edit size={14} />
                              </button>
                            )}
                            {ot.estado === 'ABIERTA' && (
                              <button
                                className="btn btn--ghost btn--sm"
                                style={{ color: 'var(--clr-danger)' }}
                                onClick={() => { if (window.confirm('¿Anular esta orden de trabajo?')) deleteMut.mutate(ot.id); }}
                                title="Anular"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
