import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';
import { formatCurrency, formatDateLocal } from '../../utils/formatters';

function Filtros({ filters, setFilters, empresas }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>F. Liquidación Inicio</label>
          <input type="date" value={filters.fecha_inicio} onChange={e => setFilters(f => ({...f, fecha_inicio: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>F. Liquidación Fin</label>
          <input type="date" value={filters.fecha_fin} onChange={e => setFilters(f => ({...f, fecha_fin: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Empresa</label>
          <select value={filters.empresa_id} onChange={e => setFilters(f => ({...f, empresa_id: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
            <option value="">Todas</option>
            {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export function InformeRemisionesLiquidadasPage() {
  const [filters, setFilters] = useState({ fecha_inicio: '', fecha_fin: '', empresa_id: '' });

  const { data: empresas } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => { const { data } = await api.get('/companies?limit=500'); return data.data || []; }
  });

  const { data: informe, isLoading, refetch } = useQuery({
    queryKey: ['informeRemisionesLiquidadas', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.fecha_inicio) params.set('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.set('fecha_fin', filters.fecha_fin);
      if (filters.empresa_id) params.set('empresa_id', filters.empresa_id);
      const { data } = await api.get('/informes/remisiones-liquidadas?' + params.toString());
      return data.data || [];
    }
  });

  const handleExport = () => {
    if (!informe || informe.length === 0) return;
    try {
      toast.loading('Exportando...', { id: 'export-rl' });
      const rows = informe.map(r => ({
        'Número Remisión': r.numero_remision,
        'Empresa': r.empresa_nombre,
        'NIT': r.empresa_nit,
        'Equipo': r.equipo_numero ? `${r.equipo_numero} ${r.equipo_marca || ''}`.trim() : 'N/A',
        'Fecha Servicio': r.fecha_servicio ? r.fecha_servicio.substring(0, 10) : '',
        'Fecha Liquidación': r.fecha_liquidacion ? r.fecha_liquidacion.substring(0, 10) : '',
        'Días Pendientes': r.dias_desde_liquidacion,
        'Total Neto': parseFloat(r.total_neto) || 0
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Remisiones Liquidadas');
      XLSX.writeFile(wb, `Remisiones_Liquidadas_Pendientes.xlsx`);
      toast.success('Exportado correctamente', { id: 'export-rl' });
    } catch (error) {
      toast.error('Error al exportar', { id: 'export-rl' });
    }
  };

  const totalMonto = informe ? informe.reduce((sum, item) => sum + (parseFloat(item.total_neto) || 0), 0) : 0;

  return (
    <div className="page-container">
      <Topbar 
        title="Remisiones Liquidadas Pendientes de Facturar" 
        breadcrumbs={[
          { label: 'Informes', path: '/informes' },
          { label: 'Rem. Liquidadas' }
        ]}
      />

      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Remisiones Liquidadas</h1>
            <p style={{ color: 'var(--text-muted)' }}>Remisiones que ya fueron liquidadas y aprobadas pero aún no han sido facturadas.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => refetch()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600 }}>
              <RefreshCw size={16} /> Refrescar
            </button>
            <button onClick={handleExport} disabled={!informe || informe.length === 0} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600 }}>
              <Download size={16} /> Exportar Excel
            </button>
          </div>
        </div>

        <Filtros filters={filters} setFilters={setFilters} empresas={empresas} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Total Remisiones</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{informe ? informe.length : 0}</div>
          </div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Valor Total Pendiente</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-color)' }}>{formatCurrency(totalMonto)}</div>
          </div>
        </div>

        <div className="card table-wrapper">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>Remisión</th>
                <th style={{ padding: '1rem' }}>Empresa</th>
                <th style={{ padding: '1rem' }}>Equipo</th>
                <th style={{ padding: '1rem' }}>Fecha Liquidación</th>
                <th style={{ padding: '1rem' }}>Días Pendientes</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos...</td>
                </tr>
              ) : informe && informe.length > 0 ? (
                informe.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{item.numero_remision}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.empresa_nombre}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NIT: {item.empresa_nit}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{item.equipo_numero ? `${item.equipo_numero} ${item.equipo_marca || ''}`.trim() : <span style={{color:'var(--text-muted)'}}>N/A</span>}</td>
                    <td style={{ padding: '1rem' }}>
                      {item.fecha_liquidacion ? formatDateLocal(item.fecha_liquidacion) : '—'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '99px', 
                        fontSize: '11px', 
                        fontWeight: 600,
                        backgroundColor: item.dias_desde_liquidacion > 30 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-subtle)',
                        color: item.dias_desde_liquidacion > 30 ? 'rgb(239, 68, 68)' : 'var(--text-secondary)'
                      }}>
                        {item.dias_desde_liquidacion} días
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--accent-color)' }}>
                      {formatCurrency(parseFloat(item.total_neto) || 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertTriangle size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p>No se encontraron remisiones liquidadas pendientes.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
