import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Fuel, ArrowLeft, RefreshCw, FileSpreadsheet, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InformesVentasCombustiblePage() {
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth);
  const [fechaFin, setFechaFin] = useState(today());
  const [appliedFilters, setAppliedFilters] = useState({ desde: firstOfMonth(), hasta: today() });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ventasCombustible', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/ventas-combustible', {
        params: { fecha_inicio: appliedFilters.desde, fecha_fin: appliedFilters.hasta }
      });
      return res.data;
    },
    enabled: !!appliedFilters?.desde && !!appliedFilters?.hasta,
  });

  const handleConsultar = () => {
    setAppliedFilters({ desde: fechaInicio, hasta: fechaFin });
  };

  const rows = data?.data || [];
  const totalBruto = rows.reduce((sum, r) => sum + parseFloat(r.total_bruto || 0), 0);
  const totalHoras = rows.reduce((sum, r) => sum + parseFloat(r.cantidad_horas || 0), 0);

  // ── Export helpers ──
  const handleExportExcel = () => {
    if (!rows.length) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      const wsData = [
        ['INFORME DE VENTAS CON COMBUSTIBLE'],
        [`Rango de fechas: ${formatDate(appliedFilters.desde)} al ${formatDate(appliedFilters.hasta)}`],
        [`Generado el: ${new Date().toLocaleString('es-CO')}`],
        [],
        ['No. Remisión', 'Fecha Servicio', 'Cliente', 'Equipo', 'Tipo Servicio', 'Estado', 'Horas', 'Valor Bruto (COP)'],
        ...rows.map(r => [
          r.numero_remision || '',
          formatDate(r.fecha_servicio),
          r.cliente || 'Sin Cliente',
          r.equipo || '—',
          r.tipo_servicio || '—',
          r.estado || '',
          parseFloat(r.cantidad_horas || 0),
          parseFloat(r.total_bruto || 0)
        ]),
        [],
        ['TOTALES', '', '', '', '', `${rows.length} Remisión(es)`, totalHoras, totalBruto]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 16 }, // No. Remisión
        { wch: 16 }, // Fecha
        { wch: 32 }, // Cliente
        { wch: 18 }, // Equipo
        { wch: 38 }, // Tipo Servicio
        { wch: 16 }, // Estado
        { wch: 14 }, // Horas
        { wch: 22 }  // Valor
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas Combustible');
      XLSX.writeFile(wb, `ventas_combustible_${appliedFilters.desde}_${appliedFilters.hasta}.xlsx`);
      toast.success('Excel exportado con éxito');
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar a Excel');
    }
  };

  const estadoColor = (estado) => {
    switch (estado) {
      case 'FACTURADA': return '#10b981';
      case 'PENDIENTE': return '#f59e0b';
      case 'EN PROCESO': return '#6366f1';
      case 'ANULADA': return '#ef4444';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <Layout
      title="Ventas con Combustible"
      subtitle="Remisiones con tipo de servicio que incluye combustible"
    >
      {/* Back link */}
      <Link
        to="/informes"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none',
          marginBottom: '1.25rem'
        }}
      >
        <ArrowLeft size={16} /> Volver a Informes
      </Link>

      {/* Filters */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem', borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem', borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <button
            onClick={handleConsultar}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <Fuel size={16} /> Consultar
          </button>
          <button
            onClick={() => refetch()}
            style={{
              padding: '0.5rem', borderRadius: '8px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center'
            }}
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
          {rows.length > 0 && (
            <button
              onClick={handleExportExcel}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.85rem'
              }}
              title="Descargar en formato Excel (.xlsx)"
            >
              <FileSpreadsheet size={16} color="#16a34a" /> Exportar Excel
            </button>
          )}
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Filtro: servicios cuyo nombre contiene "con combustible" — {rows.length} remisión(es) encontrada(s)
        </p>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando datos...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <p>Error al cargar los datos: {error.message}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Fuel size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>No se encontraron remisiones con combustible en el rango seleccionado.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>N° Remisión</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha Servicio</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Cliente</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Equipo</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo Servicio</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Horas</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                    }}
                  >
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 500 }}>{r.numero_remision || '—'}</td>
                    <td style={{ padding: '0.6rem 1rem' }}>{formatDate(r.fecha_servicio)}</td>
                    <td style={{ padding: '0.6rem 1rem' }}>{r.cliente || '—'}</td>
                    <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.equipo || '—'}</td>
                    <td style={{ padding: '0.6rem 1rem', maxWidth: '250px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        background: 'rgba(249, 115, 22, 0.1)',
                        color: '#ea580c',
                        fontSize: '0.78rem',
                        fontWeight: 500
                      }}>
                        {r.tipo_servicio || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        background: `${estadoColor(r.estado)}15`,
                        color: estadoColor(r.estado),
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}>
                        {r.estado || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                      {parseFloat(r.cantidad_horas || 0).toFixed(2)} h
                    </td>
                    <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCOP(r.total_bruto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-color)' }}>
                  <td colSpan={6} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Total ({rows.length} remisión(es))
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
                    {totalHoras.toFixed(2)} h
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCOP(totalBruto)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
