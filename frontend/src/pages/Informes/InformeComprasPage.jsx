import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Download, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';
import { formatCurrency, formatDateLocal } from '../../utils/formatters';

/* ── Componente de Filtros ─────────────────────────────── */
function Filtros({ filters, setFilters, onSearch }) {
  const bothDates = filters.fecha_desde && filters.fecha_hasta;

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Desde *</label>
          <input
            type="date"
            value={filters.fecha_desde}
            onChange={e => setFilters(f => ({ ...f, fecha_desde: e.target.value }))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Hasta *</label>
          <input
            type="date"
            value={filters.fecha_hasta}
            onChange={e => setFilters(f => ({ ...f, fecha_hasta: e.target.value }))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Buscar</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Factura, proveedor, producto..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
            />
          </div>
        </div>
        <div>
          <button
            className="btn btn--primary"
            onClick={onSearch}
            disabled={!bothDates}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '38px' }}
          >
            <Search size={16} /><span>Buscar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Página Principal ──────────────────────────────────── */
export function InformeComprasPage() {
  const [filters, setFilters] = useState({ fecha_desde: '', fecha_hasta: '', search: '' });
  const [appliedFilters, setAppliedFilters] = useState(null);

  const hasParams = appliedFilters?.fecha_desde && appliedFilters?.fecha_hasta;

  const { data: informe, isLoading, refetch } = useQuery({
    queryKey: ['informeCompras', appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('fecha_desde', appliedFilters.fecha_desde);
      params.set('fecha_hasta', appliedFilters.fecha_hasta);
      if (appliedFilters.search) params.set('search', appliedFilters.search);
      const { data } = await api.get(`/informes/compras?${params.toString()}`);
      return data;
    },
    enabled: Boolean(hasParams)
  });

  const handleSearch = () => {
    if (!filters.fecha_desde || !filters.fecha_hasta) {
      return toast.error('Selecciona un rango de fechas válido');
    }
    if (new Date(filters.fecha_desde) > new Date(filters.fecha_hasta)) {
      return toast.error('La fecha desde no puede ser mayor que la fecha hasta');
    }
    setAppliedFilters({ ...filters });
  };

  const handleExport = () => {
    if (!informe?.compras || informe.compras.length === 0) {
      return toast.error('No hay datos para exportar');
    }
    try {
      toast.loading('Exportando...', { id: 'export-compras' });

      const rows = informe.compras.map(c => ({
        'Fecha de Compra': c.fecha_compra ? formatDateLocal(c.fecha_compra) : '',
        'N° Factura': c.numero_factura,
        'Proveedor': c.proveedor_nombre,
        'Descripción Productos': c.descripcion_productos,
        'Subtotal': parseFloat(c.subtotal) || 0,
        'IVA': parseFloat(c.iva) || 0,
        'Total': parseFloat(c.total) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Establecer anchos de columna
      ws['!cols'] = [
        { wch: 14 },  // Fecha
        { wch: 16 },  // Factura
        { wch: 28 },  // Proveedor
        { wch: 65 },  // Descripción (largo para concatenación)
        { wch: 16 },  // Subtotal
        { wch: 14 },  // IVA
        { wch: 16 },  // Total
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Informe Compras');

      // Hoja de resumen
      if (informe.resumen) {
        const resumenRows = [
          { Concepto: 'Total Facturas', Valor: informe.resumen.total_facturas },
          { Concepto: 'Total Ítems', Valor: informe.resumen.total_items },
          { Concepto: 'Subtotal General', Valor: parseFloat(informe.resumen.total_subtotal) || 0 },
          { Concepto: 'IVA General', Valor: parseFloat(informe.resumen.total_iva) || 0 },
          { Concepto: 'Gran Total', Valor: parseFloat(informe.resumen.gran_total) || 0 },
        ];
        const wsRes = XLSX.utils.json_to_sheet(resumenRows);
        wsRes['!cols'] = [{ wch: 20 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');
      }

      const filename = `Informe_Compras_${appliedFilters.fecha_desde}_${appliedFilters.fecha_hasta}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Exportado correctamente', { id: 'export-compras' });
    } catch {
      toast.error('Error al exportar', { id: 'export-compras' });
    }
  };

  const resumen = informe?.resumen;
  const compras = informe?.compras || [];

  return (
    <div className="page-container">
      <Topbar
        title="Informe de Compras"
        breadcrumbs={[
          { label: 'Informes', path: '/informes' },
          { label: 'Compras' }
        ]}
      />

      <div className="page-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Informe de Compras</h1>
            <p style={{ color: 'var(--text-muted)' }}>Compras registradas por rango de fechas, agrupadas por factura.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {hasParams && (
              <button
                onClick={() => refetch()}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600 }}
              >
                <RefreshCw size={16} /> Refrescar
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={!compras.length}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600 }}
            >
              <Download size={16} /> Exportar Excel
            </button>
          </div>
        </div>

        {/* Filtros */}
        <Filtros filters={filters} setFilters={setFilters} onSearch={handleSearch} />

        {/* Tarjetas de resumen */}
        {hasParams && resumen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Total Facturas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{resumen.total_facturas}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Total Ítems</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{resumen.total_items}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Subtotal</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(resumen.total_subtotal)}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>IVA</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(resumen.total_iva)}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Gran Total</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-color, #6366f1)' }}>{formatCurrency(resumen.gran_total)}</div>
            </div>
          </div>
        )}

        {/* Tabla de resultados */}
        <div className="card">
          {!hasParams ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <ShoppingCart size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Selecciona un rango de fechas para generar el informe.</p>
            </div>
          ) : isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <RefreshCw className="spinner" size={32} style={{ color: 'var(--primary-500)' }} />
            </div>
          ) : compras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No se encontraron compras en el rango seleccionado.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    {[
                      { label: 'Fecha', align: 'left' },
                      { label: 'N° Factura', align: 'left' },
                      { label: 'Proveedor', align: 'left' },
                      { label: 'Descripción Productos', align: 'left' },
                      { label: 'Subtotal', align: 'right' },
                      { label: 'IVA', align: 'right' },
                      { label: 'Total', align: 'right' },
                    ].map(h => (
                      <th
                        key={h.label}
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: h.align,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compras.map((c, idx) => (
                    <tr key={`${c.numero_factura}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {formatDateLocal(c.fecha_compra)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '13px' }}>
                        {c.numero_factura}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600 }}>{c.proveedor_nombre}</div>
                        {c.proveedor_nit && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NIT: {c.proveedor_nit}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '400px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {c.descripcion_productos}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>
                        {formatCurrency(c.subtotal)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '13px', color: '#f59e0b' }}>
                        {formatCurrency(c.iva)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: 'var(--accent-color, #6366f1)' }}>
                        {formatCurrency(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
