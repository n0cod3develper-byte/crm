import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Plus, Search, Filter, Eye, Edit, Trash2, FileText,
  ClipboardCheck, Clock, Building2, AlertTriangle, ListChecks,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import { OtActivitiesModal } from './OtActivitiesModal';

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
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState('');

  const [filterEstado, setFilterEstado] = React.useState('all');
  const [filterTipo, setFilterTipo] = React.useState('all');
  const [selectedOtForActivities, setSelectedOtForActivities] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ordenes-trabajo', search, filterEstado, filterTipo, page, sortBy, sortOrder],
    queryFn: async () => {
      const params = { limit: 20, page };
      if (search) params.search = search;
      if (filterEstado !== 'all') params.estado = filterEstado;
      if (filterTipo !== 'all') params.tipo_mantenimiento = filterTipo;
      if (sortBy) params.sortBy = sortBy;
      if (sortOrder) params.sortOrder = sortOrder;
      const { data } = await api.get('/mantenimiento/ot', { params });
      return data;
    },
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      if (sortOrder === 'ASC') setSortOrder('DESC');
      else if (sortOrder === 'DESC') {
        setSortBy('');
        setSortOrder('');
      }
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return <span style={{ opacity: 0.3, fontSize: '0.8rem' }}>↕</span>;
    if (sortOrder === 'ASC') return <span style={{ color: 'var(--clr-primary-500)', fontSize: '0.8rem' }}>↑</span>;
    return <span style={{ color: 'var(--clr-primary-500)', fontSize: '0.8rem' }}>↓</span>;
  };

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
      <Topbar 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={22} color="var(--clr-primary-400)" />
            <span>Mantenimiento</span>
          </div>
        } 
        subtitle="Órdenes de trabajo — Correctivo y Preventivo" 
        rightContent={
          <button className="btn btn--primary" onClick={() => navigate('/mantenimiento/nueva')}>
            <Plus size={16} /> Nueva OT
          </button>
        } 
      />

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
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterEstado} onChange={e => { setFilterEstado(e.target.value); setPage(1); }}>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPage(1); }}>
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
                    <th onClick={() => handleSort('consecutivo')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Consecutivo {getSortIcon('consecutivo')}</div>
                    </th>
                    <th onClick={() => handleSort('empresa_nombre')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Empresa {getSortIcon('empresa_nombre')}</div>
                    </th>
                    <th onClick={() => handleSort('equipo_marca')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Equipo {getSortIcon('equipo_marca')}</div>
                    </th>
                    <th onClick={() => handleSort('tipo_mantenimiento')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Tipo {getSortIcon('tipo_mantenimiento')}</div>
                    </th>
                    <th onClick={() => handleSort('estado')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Estado {getSortIcon('estado')}</div>
                    </th>
                    <th>Técnico(s)</th>
                    <th onClick={() => handleSort('fecha_programada')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Programación {getSortIcon('fecha_programada')}</div>
                    </th>
                    <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Creado {getSortIcon('created_at')}</div>
                    </th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ots.map(ot => {
                    const eqName = ot.equipo_id
                      ? `${ot.equipo_marca || ''} ${ot.equipo_modelo || ''} ${ot.equipo_serial ? `(SN: ${ot.equipo_serial})` : ''}`.trim()
                      : '—';
                    const est = getEstadoStyle(ot.estado);

                    return (
                      <tr key={ot.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Wrench size={14} color="var(--text-muted)" />
                            <strong style={{ cursor: 'pointer' }} onClick={() => navigate(`/mantenimiento/${ot.id}`)} className="hover-link">
                              {ot.consecutivo}
                            </strong>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Building2 size={12} color="var(--text-muted)" />
                            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{ot.empresa_nombre}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{eqName}</td>
                        <td>
                          <span className="badge badge--gray" style={{ fontSize: '0.75rem' }}>
                            {ot.tipo_mantenimiento}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ background: est.bg, color: est.color, padding: '2px 8px', fontSize: '0.75rem' }}>
                            {ot.estado.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {ot.tecnicos && ot.tecnicos.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {ot.tecnicos.map((t, idx) => (
                                <span key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>• {t}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin asignar</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>
                            {ot.fecha_programada ? new Date(ot.fecha_programada).toLocaleDateString('es-CO') : '—'}
                          </div>
                          {ot.pm_frecuencia_id && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Freq: {ot.frecuencia_nombre} ({ot.frecuencia_horas}h)
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(ot.created_at).toLocaleDateString('es-CO')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedOtForActivities(ot.id)} title="Ver / Ingresar Actividades (Trabajo Realizado)">
                              <ListChecks size={14} />
                            </button>
                            <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/mantenimiento/${ot.id}`)} title="Ver OT">
                              <Eye size={14} />
                            </button>
                            {ot.estado !== 'LIQUIDADA' && ot.estado !== 'CERRADA' && (
                              <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/mantenimiento/${ot.id}/editar`)} title="Editar">
                                <Edit size={14} />
                              </button>
                            )}
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ color: 'var(--clr-danger)' }}
                              onClick={() => {
                                if (window.confirm('¿Anular esta orden de trabajo?')) {
                                  deleteMut.mutate(ot.id);
                                }
                              }}
                              title="Anular OT"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data?.pagination?.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem' }}>
                <button
                  className="btn btn--secondary btn--sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Página {page} de {data.pagination.totalPages}
                </span>
                <button
                  className="btn btn--secondary btn--sm"
                  disabled={page === data.pagination.totalPages}
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                >
                  Siguiente
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedOtForActivities && (
        <OtActivitiesModal 
          otId={selectedOtForActivities} 
          onClose={() => setSelectedOtForActivities(null)} 
        />
      )}
    </div>
  );
}
