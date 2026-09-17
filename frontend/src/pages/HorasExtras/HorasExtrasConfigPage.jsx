import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, RotateCcw, Clock, Percent } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';

const DIA_LABELS = {
  LUN_JUE: 'Lunes a Jueves',
  VIE: 'Viernes',
  SAB: 'Sábado',
  DOM_FESTIVO: 'Domingo / Festivo',
};

const DIA_ORDER = ['LUN_JUE', 'VIE', 'SAB', 'DOM_FESTIVO'];

const DIA_COLORS = {
  LUN_JUE: '#6366f1',
  VIE: '#3b82f6',
  SAB: '#f59e0b',
  DOM_FESTIVO: '#ef4444',
};

export function HorasExtrasConfigPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const { data: configuracion = [], isLoading } = useQuery({
    queryKey: ['he-configuracion'],
    queryFn: async () => {
      const res = await api.get('/horas-extras/configuracion');
      return res.data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/horas-extras/configuracion/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Configuración actualizada');
      qc.invalidateQueries({ queryKey: ['he-configuracion'] });
      setEditingId(null);
      setEditValues({});
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al actualizar'),
  });

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditValues({
      porcentaje: row.porcentaje,
      hora_inicio: row.hora_inicio?.substring(0, 5),
      hora_fin: row.hora_fin?.substring(0, 5),
      jornada_maxima_minutos: row.jornada_maxima_minutos,
      es_liquidable: row.es_liquidable,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, data: editValues });
  };

  // Agrupar por día
  const grouped = DIA_ORDER.map(dia => ({
    dia,
    label: DIA_LABELS[dia],
    color: DIA_COLORS[dia],
    rows: configuracion.filter(c => c.dia_aplicacion === dia),
  }));

  return (
    <Layout
      title="Configuración — Horas Extras"
      subtitle="Porcentajes, horarios y jornada máxima. Todos los valores son editables."
    >
      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {grouped.map(group => (
            <div key={group.dia} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '0.75rem 1.25rem',
                background: `${group.color}10`,
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: group.color,
                }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{group.label}</h3>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={thStyle}>Tipo de Hora</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Porcentaje</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Hora Inicio</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Hora Fin</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Jornada Máx (min)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>¿Liquida?</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(row => {
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          {row.nombre}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.tipo_hora}</div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {isEditing ? (
                            <input type="number" step="0.01" value={editValues.porcentaje}
                              onChange={e => setEditValues(v => ({ ...v, porcentaje: e.target.value }))}
                              className="input" style={{ width: 80, textAlign: 'center', padding: '3px 6px' }} />
                          ) : (
                            <span style={{
                              background: `${group.color}15`, color: group.color,
                              padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                            }}>
                              {parseFloat(row.porcentaje)}%
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {isEditing ? (
                            <input type="time" value={editValues.hora_inicio}
                              onChange={e => setEditValues(v => ({ ...v, hora_inicio: e.target.value }))}
                              className="input" style={{ padding: '3px 6px' }} />
                          ) : (
                            row.hora_inicio?.substring(0, 5)
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {isEditing ? (
                            <input type="time" value={editValues.hora_fin}
                              onChange={e => setEditValues(v => ({ ...v, hora_fin: e.target.value }))}
                              className="input" style={{ padding: '3px 6px' }} />
                          ) : (
                            row.hora_fin?.substring(0, 5)
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {isEditing ? (
                            <input type="number" value={editValues.jornada_maxima_minutos}
                              onChange={e => setEditValues(v => ({ ...v, jornada_maxima_minutos: parseInt(e.target.value) }))}
                              className="input" style={{ width: 70, textAlign: 'center', padding: '3px 6px' }} />
                          ) : (
                            <span>{row.jornada_maxima_minutos} min ({(row.jornada_maxima_minutos / 60).toFixed(1)}h)</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {isEditing ? (
                            <input type="checkbox" checked={editValues.es_liquidable}
                              onChange={e => setEditValues(v => ({ ...v, es_liquidable: e.target.checked }))}
                              style={{ width: 18, height: 18 }} />
                          ) : (
                            <span style={{
                              color: row.es_liquidable ? '#16a34a' : '#94a3b8',
                              fontWeight: 600,
                            }}>
                              {row.es_liquidable ? '✓ Sí' : '— No'}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button className="btn btn-primary btn-sm" onClick={saveEdit}
                                style={{ padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Save size={13} /> Guardar
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={cancelEdit}
                                style={{ padding: '3px 8px' }}>
                                <RotateCcw size={13} />
                              </button>
                            </div>
                          ) : (
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(row)}
                              style={{ padding: '3px 10px', fontSize: '0.75rem' }}>
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(99,102,241,0.05)',
        borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <strong>⚠️ Importante:</strong> Los cambios aplican a cálculos futuros. Las liquidaciones ya guardadas conservan los valores con los que fueron calculadas (snapshot).
      </div>
    </Layout>
  );
}

const thStyle = { textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)' };
const tdStyle = { padding: '8px 12px' };
