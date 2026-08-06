import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wrench, Download, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

function EquipoSearch({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: equipos } = useQuery({
    queryKey: ['equiposSearch', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await api.get(`/equipos?search=${encodeURIComponent(search)}&limit=15`);
      return data.data || data || [];
    },
    enabled: search.length >= 2,
    staleTime: 30000
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={14} style={{ color: 'var(--text-muted)', position: 'absolute', left: '0.5rem', zIndex: 1 }} />
        <input
          type="text"
          placeholder="Buscar por marca, serie o modelo..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => search.length >= 2 && setShowDropdown(true)}
          style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
        />
        {value && (
          <button onClick={() => { onChange(''); setSearch(''); }} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }} title="Limpiar">&times;</button>
        )}
      </div>
      {showDropdown && equipos && equipos.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: '200px', overflow: 'auto' }}>
          {equipos.map(eq => (
            <div key={eq.id} onClick={() => { onChange(eq.id); setSearch(`${eq.marca || ''} ${eq.serie || eq.modelo || ''}`); setShowDropdown(false); }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600 }}>{eq.marca} {eq.modelo || eq.serie}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Serie: {eq.serie || eq.serial || 'N/A'}</div>
            </div>
          ))}
        </div>
      )}
      {showDropdown && search.length >= 2 && equipos && equipos.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', zIndex: 50 }}>
          No se encontraron equipos
        </div>
      )}
    </div>
  );
}

function Filtros({ filters, setFilters, empresas, onSearch }) {
  const bothDates = filters.fecha_inicio && filters.fecha_fin;
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Inicio *</label>
          <input type="date" value={filters.fecha_inicio} onChange={e => setFilters(f => ({ ...f, fecha_inicio: e.target.value }))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Fin *</label>
          <input type="date" value={filters.fecha_fin} onChange={e => setFilters(f => ({ ...f, fecha_fin: e.target.value }))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Empresa</label>
          <select value={filters.empresa_id} onChange={e => setFilters(f => ({ ...f, empresa_id: e.target.value }))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
            <option value="">Todas</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Equipo</label>
          <EquipoSearch value={filters.equipo_id} onChange={id => setFilters(f => ({ ...f, equipo_id: id }))} />
        </div>
        <div>
          <button className="btn btn--primary" onClick={onSearch} disabled={!bothDates}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '38px' }}>
            <Search size={16} /><span>Buscar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function OTRow({ ot }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{ot.consecutivo}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(ot.fecha_liquidacion).toLocaleDateString('es-CO')}</div>
        </td>
        <td style={{ padding: '0.75rem 1rem' }}>
          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: ot.tipo_mantenimiento === 'CORRECTIVO' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: ot.tipo_mantenimiento === 'CORRECTIVO' ? '#ef4444' : '#22c55e', fontSize: '11px', fontWeight: 600 }}>
            {ot.tipo_mantenimiento}
          </span>
        </td>
        <td style={{ padding: '0.75rem 1rem', fontSize: '13px' }}>{ot.equipo_nombre}</td>
        <td style={{ padding: '0.75rem 1rem', fontSize: '13px' }}>{ot.empresa_nombre}</td>
        <td style={{ padding: '0.75rem 1rem', fontSize: '13px', fontWeight: 700, color: 'var(--primary-500)' }}>{fmt(ot.total_final)}</td>
        <td style={{ padding: '0.75rem 1rem', fontSize: '13px' }}>
          {ot.tecnicos.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {ot.tecnicos.map(t => (
                <span key={t.id} style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: '11px' }}>{t.nombre}</span>
              ))}
            </div>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sin asignar</span>}
        </td>
        <td style={{ padding: '0.75rem 1rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {ot.actividades_realizadas || ot.detalle_servicio || '-'}
        </td>
        <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: '0 1rem 1rem', background: 'var(--bg-app)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '13px' }}>
              <div>
                <strong>Detalle del servicio:</strong>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>{ot.detalle_servicio || 'Sin detalle'}</p>
              </div>
              <div>
                <strong>Observaciones:</strong>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>{ot.observaciones || 'Sin observaciones'}</p>
              </div>
              {ot.tecnicos.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Desglose por tecnico:</strong>
                  <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.375rem', textAlign: 'left' }}>Tecnico</th>
                        <th style={{ padding: '0.375rem', textAlign: 'right' }}>Tarifa/hr</th>
                        <th style={{ padding: '0.375rem', textAlign: 'right' }}>Horas</th>
                        <th style={{ padding: '0.375rem', textAlign: 'right' }}>Mano de Obra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ot.tecnicos.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.375rem' }}>{t.nombre}</td>
                          <td style={{ padding: '0.375rem', textAlign: 'right' }}>{fmt(t.tarifa_hora)}</td>
                          <td style={{ padding: '0.375rem', textAlign: 'right' }}>{t.horas}h</td>
                          <td style={{ padding: '0.375rem', textAlign: 'right', fontWeight: 600 }}>{fmt(t.mano_obra)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function InformeDetalleEquiposPage() {
  const [filters, setFilters] = useState({ fecha_inicio: '', fecha_fin: '', empresa_id: '', equipo_id: '' });
  const [page, setPage] = useState(1);

  const { data: empresas } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await api.get('/companies?limit=500');
      return data.data || [];
    }
  });

  const hasParams = filters.fecha_inicio && filters.fecha_fin;

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['detalleEquipos', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('fecha_inicio', filters.fecha_inicio);
      params.set('fecha_fin', filters.fecha_fin);
      if (filters.empresa_id) params.set('empresa_id', filters.empresa_id);
      if (filters.equipo_id) params.set('equipo_id', filters.equipo_id);
      params.set('page', page);
      params.set('limit', '50');
      const { data } = await api.get(`/informes/mantenimiento/detalle-equipos?${params.toString()}`);
      return data.data;
    },
    enabled: Boolean(hasParams)
  });

  const handleFilterChange = (updater) => {
    setFilters(updater);
    setPage(1);
  };

  const handleExport = async () => {
    if (!hasParams) return toast.error('Selecciona un rango de fechas');
    try {
      toast.loading('Exportando...', { id: 'export-detail' });
      const params = new URLSearchParams();
      params.set('fecha_inicio', filters.fecha_inicio);
      params.set('fecha_fin', filters.fecha_fin);
      if (filters.empresa_id) params.set('empresa_id', filters.empresa_id);
      if (filters.equipo_id) params.set('equipo_id', filters.equipo_id);
      params.set('limit', '5000');
      const { data: exportData } = await api.get(`/informes/mantenimiento/detalle-equipos?${params.toString()}`);
      const items = exportData?.data?.data || [];
      if (!items.length) { toast.error('No hay datos para exportar', { id: 'export-detail' }); return; }
      const totalRegistros = exportData?.data?.total_ot || items.length;
      if (totalRegistros > 5000) {
        toast(`Advertencia: Se exportaran los primeros 5000 de ${totalRegistros} registros`, { icon: '⚠️', duration: 5000 });
      }
      const rows = [];
      for (const ot of items) {
        const tecnicos = ot.tecnicos.length > 0 ? ot.tecnicos : [{ nombre: 'Sin asignar', horas: 0, mano_obra: 0 }];
        for (const t of tecnicos) {
          rows.push({
            Consecutivo: ot.consecutivo,
            Fecha: new Date(ot.fecha_liquidacion).toLocaleDateString('es-CO'),
            Tipo: ot.tipo_mantenimiento,
            Equipo: ot.equipo_nombre,
            Empresa: ot.empresa_nombre,
            'Valor Total': ot.total_final,
            'Mano de Obra': ot.total_mano_obra,
            Repuestos: ot.total_repuestos,
            Tecnico: t.nombre,
            'Horas Tecnico': t.horas || 0,
            Actividad: ot.actividades_realizadas || ot.detalle_servicio || ''
          });
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle Equipos');
      XLSX.writeFile(wb, `Informe_Detalle_Equipos_${filters.fecha_inicio}_${filters.fecha_fin}.xlsx`);
      toast.success('Exportado correctamente', { id: 'export-detail' });
    } catch {
      toast.error('Error exportando', { id: 'export-detail' });
    }
  };

  return (
    <div className="app-layout">
      <Topbar
        title="Detalle Mantenimiento por Equipos"
        subtitle="Listado detallado de OTs liquidadas con valor, tecnicos y actividades"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => refetch()} title="Actualizar"><RefreshCw size={16} /></button>
            <button className="btn btn--primary" onClick={handleExport} disabled={!reportData?.data?.length}>
              <Download size={16} /><span>Exportar Excel</span>
            </button>
          </div>
        }
      />
      <main className="main-content">
        <Filtros filters={filters} setFilters={handleFilterChange} empresas={empresas || []} onSearch={() => refetch()} />

        {hasParams && reportData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total OTs</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reportData.total_ot}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Valor Total</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-500)' }}>{fmt(reportData.total_valor)}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pagina</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{reportData.page} / {reportData.totalPages || 1}</div>
            </div>
          </div>
        )}

        <div className="card">
          {!hasParams ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <Wrench size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Selecciona un rango de fechas para generar el informe.</p>
            </div>
          ) : isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <RefreshCw className="spinner" size={32} style={{ color: 'var(--primary-500)' }} />
            </div>
          ) : reportData?.data?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <p>No se encontraron OTs liquidadas en el rango seleccionado.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['Consecutivo', 'Tipo', 'Equipo', 'Empresa', 'Valor', 'Tecnico(s)', 'Actividad', ''].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data.map(ot => <OTRow key={ot.ot_id} ot={ot} />)}
                  </tbody>
                </table>
              </div>
              {/* Server-side Pagination */}
              {reportData.totalPages > 1 && (
                <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Pagina {reportData.page} de {reportData.totalPages} ({reportData.total_ot} registros)
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn--ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '0.375rem' }}>
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(5, reportData.totalPages) }, (_, idx) => {
                      const pageNum = Math.max(1, Math.min(page - 2, reportData.totalPages - 4)) + idx;
                      if (pageNum > reportData.totalPages) return null;
                      return (
                        <button key={pageNum} className={`btn ${pageNum === page ? 'btn--primary' : 'btn--ghost'}`}
                          onClick={() => setPage(pageNum)} style={{ minWidth: '32px', padding: '0.375rem' }}>
                          {pageNum}
                        </button>
                      );
                    })}
                    <button className="btn btn--ghost" onClick={() => setPage(p => Math.min(reportData.totalPages, p + 1))} disabled={page === reportData.totalPages} style={{ padding: '0.375rem' }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
