import React, { useState, useCallback } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar, X, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

const EXPORT_AREAS = [
  { value: 'all',           label: 'Todas las áreas',  color: '#6366f1' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento',    color: '#3B82F6' },
  { value: 'SISTEMAS',      label: 'Sistemas',         color: '#6366F1' },
  { value: 'SST',           label: 'SST',              color: '#22C55E' },
  { value: 'LOCATIVO',      label: 'Locativo',         color: '#F97316' },
];

export function ExportInventoryModal({ onClose }) {
  const [area, setArea] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async (formato) => {
    setExporting(true);
    try {
      const params = { area, formato };
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;

      const response = await api.get('/inventory/export', {
        params,
        responseType: 'blob',
      });

      const disposition = response.headers['content-disposition'];
      let filename = `inventario_${area}_${new Date().toISOString().split('T')[0]}.${formato === 'csv' ? 'csv' : 'xlsx'}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Inventario exportado como ${formato.toUpperCase()}`);
      onClose();
    } catch (err) {
      let msg = err.message || 'Error al exportar';
      // Si responseType: 'blob', el error puede llegar como Blob en vez de JSON
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed?.error?.message || parsed?.error || msg;
        } catch (_) { /* fallback al mensaje por defecto */ }
      } else if (err.response?.data?.error?.message) {
        msg = err.response.data.error.message;
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      }
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }, [area, fechaDesde, fechaHasta, onClose]);

  // El modal NO se cierra con Escape ni con clic en el backdrop.
  // Solo se cierra con el botón X o al completar la exportación.

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={20} />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Exportar Inventario</h2>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body">
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Selecciona los filtros y el formato de exportación. Se incluirán todos los items que coincidan.
          </p>

          {/* ─── Selector de Área ─────────────────────────────── */}
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Filter size={14} /> Área
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {EXPORT_AREAS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  className={`btn btn--sm ${area === a.value ? '' : 'btn--ghost'}`}
                  onClick={() => setArea(a.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                    ...(area === a.value ? {
                      background: a.color,
                      borderColor: a.color,
                      color: '#fff',
                      fontWeight: 600,
                    } : {
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                    }),
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Rango de Fechas ──────────────────────────────── */}
          <div className="input-group" style={{ marginBottom: '1.25rem' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Calendar size={14} /> Rango de Fechas (creación del ítem)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="date"
                className="input"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                max={fechaHasta || undefined}
                placeholder="Desde"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>→</span>
              <input
                type="date"
                className="input"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                min={fechaDesde || undefined}
                placeholder="Hasta"
              />
            </div>
            {(fechaDesde || fechaHasta) && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
              >
                Limpiar fechas
              </button>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />

          <p style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Formato de exportación:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => handleExport('excel')}
              disabled={exporting}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem',
                padding: '1.25rem 1rem',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--border-color)',
                borderRadius: '12px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!exporting) e.currentTarget.style.borderColor = '#22c55e';
              }}
              onMouseLeave={e => {
                if (!exporting) e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <FileSpreadsheet size={32} color="#22c55e" />
              <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Excel (.xlsx)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Profesional con resumen, KPIs y formato contable
              </span>
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => handleExport('csv')}
              disabled={exporting}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem',
                padding: '1.25rem 1rem',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--border-color)',
                borderRadius: '12px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!exporting) e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onMouseLeave={e => {
                if (!exporting) e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <FileText size={32} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>CSV</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Ligero y editable en cualquier programa
              </span>
            </button>
          </div>

          {exporting && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', marginTop: '1rem',
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              <div className="spinner" />
              Generando archivo de exportación…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
