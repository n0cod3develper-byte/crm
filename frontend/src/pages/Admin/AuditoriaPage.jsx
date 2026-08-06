import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Download, Filter, ChevronLeft, ChevronRight, Eye, X, Clock, User, Globe, Server, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';

function JsonViewer({ data, label }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin datos</span>;
  }

  const renderValue = (value) => {
    if (value === null || value === undefined) return <span style={{ color: 'var(--text-muted)' }}>null</span>;
    if (typeof value === 'boolean') return <span style={{ color: '#f59e0b' }}>{value.toString()}</span>;
    if (typeof value === 'number') return <span style={{ color: '#3b82f6' }}>{value}</span>;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return <span style={{ color: '#8b5cf6' }}>{new Date(value).toLocaleString('es-CO')}</span>;
      }
      return <span style={{ color: '#22c55e' }}>{JSON.stringify(value)}</span>;
    }
    if (Array.isArray(value)) {
      return (
        <div style={{ paddingLeft: '1rem' }}>
          {value.map((item, i) => (
            <div key={i} style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>[{i}]</span> {renderValue(item)}
            </div>
          ))}
        </div>
      );
    }
    if (typeof value === 'object') {
      return (
        <div style={{ paddingLeft: '1rem' }}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: '#f97316', fontWeight: 500 }}>{k}:</span> {renderValue(v)}
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  };

  return (
    <div style={{ background: 'var(--bg-app)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border-color)' }}>
      {label && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{label}</div>}
      <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {renderValue(data)}
      </pre>
    </div>
  );
}

function MetodoBadge({ metodo }) {
  const colors = {
    POST: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    PUT: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    PATCH: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    DELETE: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
  };
  const style = colors[metodo] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', background: style.bg, color: style.color }}>
      {metodo}
    </span>
  );
}

function AccionBadge({ accion }) {
  const colors = {
    CREATE: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', label: 'Crear' },
    UPDATE: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Actualizar' },
    DELETE: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'Eliminar' }
  };
  const style = colors[accion] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: accion };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

export function AuditoriaPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ modulo: '', accion: '', search: '', fechaDesde: '', fechaHasta: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const limit = 20;

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limit);
      if (filters.modulo) params.set('modulo', filters.modulo);
      if (filters.accion) params.set('accion', filters.accion);
      if (filters.search) params.set('search', filters.search);
      if (filters.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.set('fechaHasta', filters.fechaHasta);
      const { data } = await api.get(`/admin/auditoria?${params.toString()}`);
      return data;
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ['auditStats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/auditoria/stats');
      return data;
    }
  });

  const { data: modulosData } = useQuery({
    queryKey: ['auditModulos'],
    queryFn: async () => {
      const { data } = await api.get('/admin/auditoria/modulos');
      return data;
    }
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ modulo: '', accion: '', search: '', fechaDesde: '', fechaHasta: '' });
    setPage(1);
  };

  const handleExport = async () => {
    try {
      toast.loading('Exportando logs...', { id: 'export-audit' });
      const params = new URLSearchParams();
      if (filters.modulo) params.set('modulo', filters.modulo);
      if (filters.accion) params.set('accion', filters.accion);
      if (filters.search) params.set('search', filters.search);
      if (filters.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.set('fechaHasta', filters.fechaHasta);
      const { data } = await api.get(`/admin/auditoria/export?${params.toString()}`);
      if (data.data && data.data.length > 0) {
        const headers = Object.keys(data.data[0]);
        const csvContent = [
          headers.join(','),
          ...data.data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_logs_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        toast.success('Exportacion completada', { id: 'export-audit' });
      } else {
        toast.error('No hay datos para exportar', { id: 'export-audit' });
      }
    } catch {
      toast.error('Error exportando logs', { id: 'export-audit' });
    }
  };

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || {};
  const stats = statsData?.data || {};
  const modulos = modulosData?.data || [];
  const hasActiveFilters = filters.modulo || filters.accion || filters.search || filters.fechaDesde || filters.fechaHasta;

  return (
    <div className="app-layout">
      <Topbar
        title="Auditoria del Sistema"
        subtitle="Registro de todas las operaciones de escritura en el CRM"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => refetch()} title="Actualizar">
              <RefreshCw size={16} />
            </button>
            <button className="btn btn--primary" onClick={handleExport}>
              <Download size={16} />
              <span>Exportar CSV</span>
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* Estadisticas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--primary-10)', borderRadius: 'var(--radius-md)', color: 'var(--primary-600)' }}>
              <Server size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Registros</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.total_logs || 0}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.1)', borderRadius: 'var(--radius-md)', color: '#22c55e' }}>
              <User size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Usuarios Activos</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.unique_users || 0}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(139,92,246,0.1)', borderRadius: 'var(--radius-md)', color: '#8b5cf6' }}>
              <Globe size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Modulos Afectados</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.unique_modules || 0}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-md)', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ultima Actividad</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {stats.last_activity ? new Date(stats.last_activity).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input type="text" placeholder="Buscar por usuario, ruta o modulo..." value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '14px' }}
              />
            </div>
            <button className="btn btn--secondary" onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} />
              <span>Filtros{hasActiveFilters && ' *'}</span>
            </button>
            {hasActiveFilters && (
              <button className="btn btn--ghost" onClick={handleClearFilters} style={{ fontSize: '13px' }}>Limpiar filtros</button>
            )}
          </div>

          {showFilters && (
            <div style={{ padding: '0 1rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Modulo</label>
                <select value={filters.modulo} onChange={(e) => handleFilterChange('modulo', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
                  <option value="">Todos</option>
                  {modulos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Accion</label>
                <select value={filters.accion} onChange={(e) => handleFilterChange('accion', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
                  <option value="">Todas</option>
                  <option value="CREATE">Crear</option>
                  <option value="UPDATE">Actualizar</option>
                  <option value="DELETE">Eliminar</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Desde</label>
                <input type="date" value={filters.fechaDesde} onChange={(e) => handleFilterChange('fechaDesde', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Hasta</label>
                <input type="date" value={filters.fechaHasta} onChange={(e) => handleFilterChange('fechaHasta', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabla de logs */}
        <div className="card">
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <RefreshCw className="spinner" size={32} style={{ color: 'var(--primary-500)' }} />
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <Shield size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Sin registros de auditoria</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No se encontraron logs con los filtros actuales.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    {['Fecha', 'Usuario', 'Modulo', 'Accion', 'Metodo', 'Ruta', 'IP', 'Detalle'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === 'Detalle' ? 'center' : 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px' }}>{new Date(log.created_at).toLocaleDateString('es-CO')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString('es-CO')}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 500 }}>{log.user_name || 'Sistema'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '11px', fontWeight: 600 }}>{log.modulo}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}><AccionBadge accion={log.accion} /></td>
                      <td style={{ padding: '0.75rem 1rem' }}><MetodoBadge metodo={log.metodo} /></td>
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{log.ruta}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '12px', color: 'var(--text-muted)' }}>{log.ip_address || 'N/A'}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button className="btn btn--ghost" onClick={() => setSelectedLog(log)} style={{ padding: '0.25rem 0.5rem' }} title="Ver detalle">
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginacion */}
          {pagination.totalPages > 1 && (
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, pagination.total)} de {pagination.total} registros
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="btn btn--ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '0.375rem' }}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2, pagination.totalPages - 4)) + i;
                  if (pageNum > pagination.totalPages) return null;
                  return (
                    <button key={pageNum} className={`btn ${pageNum === page ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setPage(pageNum)} style={{ minWidth: '32px', padding: '0.375rem' }}>
                      {pageNum}
                    </button>
                  );
                })}
                <button className="btn btn--ghost" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} style={{ padding: '0.375rem' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal de detalle */}
        {selectedLog && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
            onClick={() => setSelectedLog(null)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', maxWidth: '700px', width: '100%', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border-color)' }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} color="var(--primary-500)" />
                  Detalle del Log #{selectedLog.id}
                </h3>
                <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Fecha y Hora</div>
                    <div style={{ fontWeight: 600 }}>{new Date(selectedLog.created_at).toLocaleString('es-CO')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Usuario</div>
                    <div style={{ fontWeight: 600 }}>{selectedLog.user_name || 'Sistema'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Modulo / Accion</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '11px', fontWeight: 600 }}>{selectedLog.modulo}</span>
                      <AccionBadge accion={selectedLog.accion} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Metodo / Ruta</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <MetodoBadge metodo={selectedLog.metodo} />
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{selectedLog.ruta}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Direccion IP</div>
                  <div style={{ fontSize: '13px' }}>{selectedLog.ip_address || 'N/A'}</div>
                </div>

                {selectedLog.user_agent && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>User Agent</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{selectedLog.user_agent}</div>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <JsonViewer data={selectedLog.datos_antes} label="Datos Antes" />
                </div>
                <div>
                  <JsonViewer data={selectedLog.datos_despues} label="Datos Despues" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
