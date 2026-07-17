import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { SearchableSelect } from '../../../../components/ui/SearchableSelect';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VENTANA_OPTIONS = [
  { label: '15 días', value: 15 },
  { label: '30 días', value: 30 },
  { label: '45 días', value: 45 },
  { label: '60 días', value: 60 },
];

export default function KpiReincidenciaFallas({ appliedFilters }) {
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [ventana, setVentana] = useState(30);
  const [expanded, setExpanded] = useState(false);

  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['mantenimiento-reincidencia', appliedFilters, empresaFiltro, ventana],
    queryFn: async () => {
      const params = { dias_ventana: ventana };
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      if (empresaFiltro) params.empresa_id = empresaFiltro;
      const res = await api.get('/informes/mantenimiento/reincidencia-fallas', { params });
      return res.data.data;
    }
  });

  const casos = data?.casos || [];
  const pct = data?.reincidencia_pct ?? 0;
  const colorSemaforo = pct === 0 ? '#4ade80' : pct < 10 ? '#facc15' : '#f87171';

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Reincidencia de Fallas
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            className="input"
            value={ventana}
            onChange={e => setVentana(parseInt(e.target.value))}
            style={{ maxWidth: '120px', fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
          >
            {VENTANA_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{ width: '250px' }}>
            <SearchableSelect
              fetchFn={searchCompanies}
              value={empresaFiltro}
              onChange={val => setEmpresaFiltro(val || '')}
              placeholder="Todas las empresas..."
              noOptionsMessage="No se encontraron empresas"
              name="empresa_id"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Indicadores resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'OTs Correctivas', value: data?.total_ordenes_correctivas ?? 0, color: '#94a3b8' },
              { label: 'Con Reincidencia', value: data?.ordenes_reincidentes_count ?? 0, color: '#fb923c' },
              { label: '% Reincidencia', value: `${pct}%`, color: colorSemaforo },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid #334155',
                borderRadius: '10px', padding: '0.85rem', textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{item.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Banner estado */}
          <div style={{
            background: pct === 0 ? 'rgba(74,222,128,0.1)' : pct < 10 ? 'rgba(250,204,21,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${colorSemaforo}40`,
            borderRadius: '10px', padding: '0.85rem 1rem',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            marginBottom: casos.length > 0 ? '1rem' : 0
          }}>
            {pct === 0
              ? <CheckCircle2 size={16} color="#4ade80" />
              : <AlertTriangle size={16} color={colorSemaforo} />
            }
            <span style={{ fontSize: '0.84rem', color: colorSemaforo, fontWeight: 600 }}>
              {pct === 0
                ? 'Sin reincidencias detectadas en el período.'
                : `${casos.length} caso(s) de reincidencia en ventana de ${ventana} días.`}
            </span>
          </div>

          {/* Lista de casos */}
          {casos.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(x => !x)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  color: '#94a3b8', fontSize: '0.82rem', padding: '0.5rem 0',
                }}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Ocultar detalle' : `Ver ${casos.length} caso(s) de reincidencia`}
              </button>

              {expanded && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
                  {casos.map((caso, i) => (
                    <div key={i} style={{
                      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                      borderRadius: '8px', padding: '0.75rem 1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#e2e8f0' }}>{caso.equipo}</span>
                          <span style={{
                            marginLeft: '0.5rem', background: 'rgba(248,113,113,0.2)',
                            color: '#f87171', fontSize: '0.72rem', padding: '0.1rem 0.5rem',
                            borderRadius: '4px', fontWeight: 600
                          }}>{caso.componente}</span>
                        </div>
                        <span style={{
                          background: 'rgba(250,204,21,0.15)', color: '#facc15',
                          fontSize: '0.78rem', padding: '0.15rem 0.6rem',
                          borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap'
                        }}>
                          {caso.dias_transcurridos} días
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                        {caso.empresa} · {formatDate(caso.fecha_anterior)} → {formatDate(caso.fecha_actual)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
