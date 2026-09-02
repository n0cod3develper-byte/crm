import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function ClasificacionCuentasTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [soloSinClasificar, setSoloSinClasificar] = useState(false);

  const { data: cuentas = [], isLoading: isLoadingCuentas } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => {
      const res = await api.get('/contabilidad/cuentas');
      return res.data || [];
    }
  });

  const { data: rubros = [] } = useQuery({
    queryKey: ['contabilidad-rubros'],
    queryFn: async () => {
      const res = await api.get('/contabilidad/rubros');
      return (res.data || []).filter(r => !r.es_subtotal);
    }
  });

  const updateMapeoMutation = useMutation({
    mutationFn: async ({ codigo, rubroId }) => {
      await api.put(`/contabilidad/cuentas/${codigo}/mapeo`, { rubroId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contabilidad-cuentas']);
      queryClient.invalidateQueries(['contabilidad-reporte']);
      toast.success('Clasificación de cuenta actualizada');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al actualizar clasificación');
    }
  });

  // Group rubros by section/report for clean select options
  const rubrosGrouped = useMemo(() => {
    const groups = {};
    rubros.forEach(r => {
      const key = `${r.reporte === 'BALANCE' ? 'Balance General' : 'Estado de Resultados'} - ${r.seccion}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [rubros]);

  const filteredCuentas = useMemo(() => {
    return cuentas.filter(c => {
      const matchSearch = 
        c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSinClasificar = soloSinClasificar ? !c.rubro_asignado : true;

      return matchSearch && matchSinClasificar;
    });
  }, [cuentas, searchTerm, soloSinClasificar]);

  const sinClasificarCount = useMemo(() => {
    return cuentas.filter(c => !c.rubro_asignado).length;
  }, [cuentas]);

  return (
    <div>
      {/* Alert if unclassified accounts exist */}
      {sinClasificarCount > 0 && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle className="text-warning" size={24} style={{ color: '#eab308' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Hay {sinClasificarCount} cuenta(s) sin clasificar en el catálogo
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Asigna un rubro a cada cuenta para que los reportes de Balance y Estado de Resultados reflejen los saldos correctamente.
              </div>
            </div>
          </div>
          <button
            className={`btn ${soloSinClasificar ? 'btn--secondary' : 'btn--primary'}`}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            onClick={() => setSoloSinClasificar(!soloSinClasificar)}
          >
            {soloSinClasificar ? 'Ver todas las cuentas' : 'Filtrar sólo sin clasificar'}
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.25rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '260px', maxWidth: '420px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            placeholder="Buscar por código o nombre de cuenta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={soloSinClasificar}
              onChange={(e) => setSoloSinClasificar(e.target.checked)}
              style={{ borderRadius: '4px', cursor: 'pointer' }}
            />
            Sólo sin clasificar ({sinClasificarCount})
          </label>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.75rem 1rem', width: '140px', fontWeight: 600, fontSize: '0.85rem' }}>Código PUC</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.85rem' }}>Nombre de Cuenta</th>
              <th style={{ padding: '0.75rem 1rem', width: '380px', fontWeight: 600, fontSize: '0.85rem' }}>Rubro de Reporte Asignado</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingCuentas ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Cargando cuentas...
                </td>
              </tr>
            ) : filteredCuentas.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No se encontraron cuentas con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredCuentas.map((c) => {
                const currentRubro = rubros.find(r => r.nombre === c.rubro_asignado);
                return (
                  <tr key={c.codigo} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                      {c.codigo}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                      {c.nombre}
                    </td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <select
                        className="input"
                        style={{
                          width: '100%',
                          fontSize: '0.85rem',
                          padding: '0.375rem 0.5rem',
                          borderColor: c.rubro_asignado ? 'var(--border-color)' : '#eab308',
                          background: c.rubro_asignado ? 'transparent' : 'rgba(234, 179, 8, 0.05)'
                        }}
                        value={currentRubro?.id || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            updateMapeoMutation.mutate({ codigo: c.codigo, rubroId: e.target.value });
                          }
                        }}
                      >
                        <option value="">-- Sin Clasificar --</option>
                        {Object.entries(rubrosGrouped).map(([groupName, items]) => (
                          <optgroup key={groupName} label={groupName}>
                            {items.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
