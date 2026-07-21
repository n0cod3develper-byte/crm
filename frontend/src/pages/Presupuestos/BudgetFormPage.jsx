import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { Save, RefreshCw, Plus, Trash2, Calendar, MapPin, AlertTriangle, Settings } from 'lucide-react';

const MONTHS = [
  { id: 1, name: 'Ene' }, { id: 2, name: 'Feb' }, { id: 3, name: 'Mar' },
  { id: 4, name: 'Abr' }, { id: 5, name: 'May' }, { id: 6, name: 'Jun' },
  { id: 7, name: 'Jul' }, { id: 8, name: 'Ago' }, { id: 9, name: 'Sep' },
  { id: 10, name: 'Oct' }, { id: 11, name: 'Nov' }, { id: 12, name: 'Dic' },
];

const MONTHS_FULL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(value || 0);
}

// ══════════════════════════════════════════════════════
// ÁREA 1 — MANTENIMIENTO: Presupuesto por Línea de Negocio
// ══════════════════════════════════════════════════════

function BudgetMantenimientoForm({ areaId }) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [linesData, setLinesData] = useState([]);
  const [totalAnnual, setTotalAnnual] = useState('');

  // Fetch Annual Budget para el área actual
  const { data: annualBudget, isLoading: loadingAnnual } = useQuery({
    queryKey: ['annualBudget', areaId, year],
    queryFn: async () => {
      const res = await api.get('/budget/annual', { params: { area_id: areaId, year } });
      return res.data;
    }
  });

  useEffect(() => {
    setTotalAnnual(annualBudget?.total_amount ? String(annualBudget.total_amount) : '');
  }, [annualBudget]);

  // Catálogo de líneas de negocio
  const { data: businessLines, isLoading: loadingLines } = useQuery({
    queryKey: ['businessLines'],
    queryFn: async () => {
      const res = await api.get('/budget/business-lines');
      return res.data.data || [];
    },
  });

  // Presupuesto guardado
  const { data: presupuestoData, isLoading: loadingPresupuesto, refetch } = useQuery({
    queryKey: ['mantenimientoPresupuesto', year],
    queryFn: async () => {
      const res = await api.get('/budget/mantenimiento', { params: { year } });
      return res.data.data || [];
    },
  });

  useEffect(() => {
    if (presupuestoData && businessLines) {
      // Agrupar por línea
      const grouped = {};
      presupuestoData.forEach(row => {
        if (!grouped[row.linea_negocio_id]) {
          grouped[row.linea_negocio_id] = MONTHS.map(m => ({ month: m.id, amount: '' }));
        }
        const mItem = grouped[row.linea_negocio_id].find(m => m.month === row.month);
        if (mItem) mItem.amount = row.amount > 0 ? String(row.amount) : '';
      });

      const initialData = Object.keys(grouped).map(lineaId => ({
        localId: Math.random().toString(),
        linea_negocio_id: Number(lineaId),
        monthly: grouped[lineaId]
      }));

      setLinesData(initialData);
    } else {
      setLinesData([]);
    }
  }, [presupuestoData, businessLines, year]);

  const handleAddLine = () => {
    setLinesData([...linesData, {
      localId: Math.random().toString(),
      linea_negocio_id: '',
      monthly: MONTHS.map(m => ({ month: m.id, amount: '' }))
    }]);
  };

  const handleRemoveLine = (index) => {
    if (confirm('¿Estás seguro de quitar esta línea de presupuesto de la vista?')) {
      const newArr = [...linesData];
      newArr.splice(index, 1);
      setLinesData(newArr);
    }
  };

  const updateLineData = (index, field, value) => {
    const newArr = [...linesData];
    newArr[index][field] = value;
    setLinesData(newArr);
  };

  const updateMonthlyData = (lineIndex, monthIndex, field, value) => {
    const newArr = [...linesData];
    newArr[lineIndex].monthly[monthIndex][field] = value;
    setLinesData(newArr);
  };

  const totalGeneral = useMemo(() => {
    return linesData.reduce((acc, line) => {
      const lineTotal = line.monthly.reduce((mAcc, m) => mAcc + (parseFloat(m.amount) || 0), 0);
      return acc + lineTotal;
    }, 0);
  }, [linesData]);

  const annualTarget = parseFloat(totalAnnual) || 0;
  const isOverBudget = totalGeneral > annualTarget;

  const handleSave = async () => {
    if (!totalAnnual || annualTarget <= 0) {
      return toast.error('Debes definir un Presupuesto Anual válido');
    }
    if (isOverBudget) {
      return toast.error('El presupuesto mensual asignado supera el Presupuesto Anual Total');
    }

    // Validar líneas repetidas o vacías
    const selectedLines = new Set();
    for (const line of linesData) {
      if (!line.linea_negocio_id) continue;
      if (selectedLines.has(line.linea_negocio_id)) {
        return toast.error('Has seleccionado la misma línea de negocio más de una vez.');
      }
      selectedLines.add(line.linea_negocio_id);
    }

    try {
      // 1. Guardar el presupuesto anual del área
      await api.post('/budget/annual', {
        area_id: areaId,
        year,
        total_amount: annualTarget
      });

      // 2. Guardar el desglose mensual
      const rows = [];
      linesData.forEach(line => {
        if (!line.linea_negocio_id) return;
        line.monthly.forEach(m => {
          rows.push({
            linea_negocio_id: line.linea_negocio_id,
            month: m.month,
            amount: parseFloat(m.amount) || 0
          });
        });
      });

      if (rows.length === 0) {
        return toast.error('Debe agregar al menos una línea de negocio.');
      }

      await api.post('/budget/mantenimiento', { year, rows });
      toast.success('Presupuesto guardado correctamente');
      queryClient.invalidateQueries(['annualBudget', areaId, year]);
      queryClient.invalidateQueries(['mantenimientoPresupuesto', year]);
      refetch();
    } catch (err) {
      toast.error('Error al guardar presupuesto');
    }
  };

  const handleClear = () => {
    if (confirm('¿Limpiar formulario?')) {
      setLinesData([]);
    }
  };

  return (
    <div>
      {/* ── Selector de Año ── */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          Sección 1 — Año Fiscal
        </h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Seleccionar Año</label>
            <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 1 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <label className="label">Presupuesto Anual Total ($)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                className="input" 
                value={totalAnnual} 
                onChange={e => setTotalAnnual(e.target.value)} 
                placeholder="Ej. 150000000"
              />
              {annualTarget > 0 && (
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {formatCOP(annualTarget)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Por Línea de Negocio ── */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          Sección 2 — Presupuesto por Línea de Negocio
        </h3>

        {linesData.map((line, index) => {
          const lineTotal = line.monthly.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
          return (
            <div key={line.localId} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 600 }}>Línea de Negocio {index + 1}</h4>
                <button className="btn btn--danger btn--icon" onClick={() => handleRemoveLine(index)} title="Eliminar línea">
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <label className="label">Seleccionar Línea de Negocio</label>
                  <select className="input" value={line.linea_negocio_id} onChange={e => updateLineData(index, 'linea_negocio_id', Number(e.target.value))}>
                    <option value="">-- Seleccione una línea --</option>
                    {businessLines?.map(b => (
                      <option key={b.id} value={b.id} disabled={linesData.some(ld => ld !== line && ld.linea_negocio_id === b.id)}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="label">Total Asignado a esta Línea</label>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--clr-primary-500)', paddingTop: '0.25rem' }}>
                    {formatCOP(lineTotal)}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '400px', fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Mes</th>
                      <th>Presupuesto ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.monthly.map((m, mIndex) => (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 500 }}>{MONTHS_FULL[m.month - 1]}</td>
                        <td>
                          <input type="number" className="input" style={{ padding: '0.4rem' }} value={m.amount} onChange={e => updateMonthlyData(index, mIndex, 'amount', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <button className="btn btn--secondary" onClick={handleAddLine} style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={linesData.length >= (businessLines?.length || 0)}>
          <Plus size={16} /> Agregar Línea de Presupuesto
        </button>
      </div>

      {/* ── Resumen ── */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          Sección 3 — Resumen y Acciones
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Presupuesto Anual Configurado</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                {formatCOP(annualTarget)}
              </h3>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Asignado a Líneas</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: isOverBudget ? 'var(--clr-danger-500)' : 'var(--clr-success-500)' }}>
                {formatCOP(totalGeneral)}
              </h3>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Diferencia</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: annualTarget - totalGeneral < 0 ? 'var(--clr-danger-500)' : 'inherit' }}>
                {formatCOP(annualTarget - totalGeneral)}
              </h3>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn--secondary" onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Limpiar
            </button>
            <button className="btn btn--primary" onClick={handleSave} disabled={isOverBudget || !annualTarget} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> Guardar Presupuesto
            </button>
          </div>
        </div>

        {isOverBudget && (
          <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--clr-danger-400)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--clr-danger-600)' }}>
            <AlertTriangle size={20} />
            <p style={{ margin: 0, fontWeight: 500 }}>El total asignado a las líneas supera el presupuesto anual configurado para el área.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ÁREA 2 — SERVICIOS: Presupuesto por Equipo (sin cambios)
// ══════════════════════════════════════════════════════

function BudgetEquiposForm({ areaId }) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [totalAnnual, setTotalAnnual] = useState('');
  const [equipmentsData, setEquipmentsData] = useState([]);

  const { data: areas } = useQuery({
    queryKey: ['budgetAreas'],
    queryFn: async () => (await api.get('/budget/areas')).data
  });
  const currentArea = areas?.find(a => a.id === Number(areaId));

  const { data: annualBudget } = useQuery({
    queryKey: ['annualBudget', areaId, year],
    queryFn: async () => {
      const res = await api.get('/budget/annual', { params: { area_id: areaId, year } });
      return res.data;
    }
  });

  const { data: allEquipos } = useQuery({
    queryKey: ['equipos', 'all'],
    queryFn: async () => {
      const res = await api.get('/equipos/by-company/cargar');
      return res.data.data || [];
    }
  });

  const { data: existingEquipments, refetch: refetchEquipments } = useQuery({
    queryKey: ['equipmentBudgets', annualBudget?.id],
    queryFn: async () => {
      if (!annualBudget?.id) return [];
      const res = await api.get('/budget/equipment', { params: { budget_annual_id: annualBudget.id } });
      return res.data;
    },
    enabled: !!annualBudget?.id
  });

  useEffect(() => {
    setTotalAnnual(annualBudget?.total_amount ? annualBudget.total_amount : '');
  }, [annualBudget]);

  useEffect(() => {
    if (existingEquipments?.length > 0) {
      setEquipmentsData(existingEquipments.map(eq => ({
        localId: eq.id || Math.random().toString(),
        isExisting: !!eq.id,
        id: eq.id,
        equipment_id: eq.equipment_id,
        location: eq.location || '',
        working_days: eq.working_days || '',
        monthly: MONTHS.map(m => {
          const detail = eq.monthly_details?.find(d => d.month === m.id);
          return { month: m.id, amount: detail?.amount || '', working_days: detail?.working_days || '' };
        })
      })));
    } else {
      setEquipmentsData([]);
    }
  }, [existingEquipments]);

  const handleAddEquipment = () => {
    setEquipmentsData([...equipmentsData, {
      localId: Math.random().toString(),
      isExisting: false,
      equipment_id: '',
      location: '',
      working_days: '',
      monthly: MONTHS.map(m => ({ month: m.id, amount: '', working_days: '' }))
    }]);
  };

  const handleRemoveEquipment = async (index, eq) => {
    if (eq.isExisting) {
      if (confirm('¿Estás seguro de eliminar este presupuesto de equipo?')) {
        try {
          await api.delete(`/budget/equipment/${eq.id}`);
          toast.success('Presupuesto de equipo eliminado');
          refetchEquipments();
        } catch { toast.error('Error al eliminar'); }
      }
    } else {
      const newArr = [...equipmentsData];
      newArr.splice(index, 1);
      setEquipmentsData(newArr);
    }
  };

  const updateEqData = (index, field, value) => {
    const newArr = [...equipmentsData];
    newArr[index][field] = value;
    setEquipmentsData(newArr);
  };

  const updateMonthlyData = (eqIndex, monthIndex, field, value) => {
    const newArr = [...equipmentsData];
    newArr[eqIndex].monthly[monthIndex][field] = value;
    setEquipmentsData(newArr);
  };

  const totalAllocated = useMemo(() =>
    equipmentsData.reduce((acc, eq) =>
      acc + eq.monthly.reduce((mAcc, m) => mAcc + (parseFloat(m.amount) || 0), 0), 0),
    [equipmentsData]
  );

  const annualTarget = parseFloat(totalAnnual) || 0;
  const isOverBudget = totalAllocated > annualTarget;

  const handleSave = async () => {
    if (!totalAnnual || annualTarget <= 0) return toast.error('Debes definir un Presupuesto Anual válido');
    if (isOverBudget) return toast.error('El presupuesto mensual asignado supera el Presupuesto Anual Total');

    for (const eq of equipmentsData) {
      if (!eq.equipment_id) continue;
      for (const m of eq.monthly) {
        const wd = parseInt(m.working_days) || 0;
        if (wd !== 0 && (wd < 1 || wd > 31)) return toast.error('Los días hábiles por mes deben estar entre 1 y 31');
      }
    }

    try {
      const annualRes = await api.post('/budget/annual', { area_id: areaId, year, total_amount: annualTarget });
      const bAnnualId = annualRes.data.id;
      for (const eq of equipmentsData) {
        if (!eq.equipment_id) continue;
        await api.post('/budget/equipment', {
          budget_annual_id: bAnnualId,
          equipment_id: eq.equipment_id,
          location: eq.location,
          working_days: parseInt(eq.working_days) || null,
          monthly_details: eq.monthly.map(m => ({
            month: m.month,
            amount: parseFloat(m.amount) || 0,
            working_days: parseInt(m.working_days) || 0
          }))
        });
      }
      toast.success('Presupuesto guardado exitosamente');
      queryClient.invalidateQueries(['annualBudget', areaId, year]);
      refetchEquipments();
    } catch (err) {
      toast.error('Error al guardar el presupuesto');
    }
  };

  return (
    <div>
      {/* Sección 1: Presupuesto Anual */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          Sección 1 — Presupuesto Anual del Área
        </h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Año Fiscal</label>
            <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 1 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <label className="label">Presupuesto Anual Total ($)</label>
            <div style={{ position: 'relative' }}>
              <input type="number" className="input" value={totalAnnual} onChange={e => setTotalAnnual(e.target.value)} placeholder="Ej. 150000000" />
              {annualTarget > 0 && (
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {formatCOP(annualTarget)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2: Por Equipo */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          Sección 2 — Presupuesto por Equipo/Máquina
        </h3>
        {equipmentsData.map((eq, index) => (
          <div key={eq.localId} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontWeight: 600 }}>Equipo {index + 1}</h4>
              <button className="btn btn--danger btn--icon" onClick={() => handleRemoveEquipment(index, eq)} title="Eliminar equipo">
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <div style={{ flex: '2 1 300px' }}>
                <label className="label">Seleccionar Equipo/Máquina</label>
                <select className="input" value={eq.equipment_id} onChange={e => updateEqData(index, 'equipment_id', e.target.value)}>
                  <option value="">-- Seleccione un equipo --</option>
                  {allEquipos?.map(e => (
                    <option key={e.id} value={e.id}>{e.marca} {e.modelo} - Serie: {e.serie}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label className="label">Ubicación (Opcional)</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                  <input type="text" className="input" style={{ paddingLeft: '2rem' }} value={eq.location} onChange={e => updateEqData(index, 'location', e.target.value)} />
                </div>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="label">Días Hábiles (Año)</label>
                <input type="number" className="input" min="0" max="366" value={eq.working_days} onChange={e => updateEqData(index, 'working_days', e.target.value)} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '800px', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Mes</th>
                    <th>Presupuesto ($)</th>
                    <th style={{ width: '100px' }}>Días Hábiles</th>
                  </tr>
                </thead>
                <tbody>
                  {eq.monthly.map((m, mIndex) => (
                    <tr key={m.month}>
                      <td style={{ fontWeight: 500 }}>{MONTHS_FULL[m.month - 1]}</td>
                      <td><input type="number" className="input" style={{ padding: '0.4rem' }} value={m.amount} onChange={e => updateMonthlyData(index, mIndex, 'amount', e.target.value)} /></td>
                      <td><input type="number" className="input" style={{ padding: '0.4rem' }} min="0" max="31" value={m.working_days} onChange={e => updateMonthlyData(index, mIndex, 'working_days', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <button className="btn btn--secondary" onClick={handleAddEquipment} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Agregar otro equipo
        </button>
      </div>

      {/* Sección 3: Resumen */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          Sección 3 — Resumen y Acciones
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Presupuesto Anual</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{formatCOP(annualTarget)}</h3>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Asignado a Equipos</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: isOverBudget ? 'var(--clr-danger-500)' : 'var(--clr-success-500)' }}>
                {formatCOP(totalAllocated)}
              </h3>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Diferencia</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: annualTarget - totalAllocated < 0 ? 'var(--clr-danger-500)' : 'inherit' }}>
                {formatCOP(annualTarget - totalAllocated)}
              </h3>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn--secondary" onClick={() => { setTotalAnnual(annualBudget?.total_amount || ''); setEquipmentsData([]); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Limpiar
            </button>
            <button className="btn btn--primary" onClick={handleSave} disabled={isOverBudget || !annualTarget} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> Guardar Presupuesto
            </button>
          </div>
        </div>
        {isOverBudget && (
          <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--clr-danger-400)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--clr-danger-600)' }}>
            <AlertTriangle size={20} />
            <p style={{ margin: 0, fontWeight: 500 }}>El total asignado a los equipos supera el presupuesto anual configurado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — bifurca por areaId
// ══════════════════════════════════════════════════════

export function BudgetFormPage() {
  const { areaId } = useParams();
  const navigate = useNavigate();

  const { data: areas } = useQuery({
    queryKey: ['budgetAreas'],
    queryFn: async () => (await api.get('/budget/areas')).data
  });
  const currentArea = areas?.find(a => a.id === Number(areaId));

  const isMantenimiento = Number(areaId) === 1;

  return (
    <Layout
      title={`Presupuesto: ${currentArea?.name || 'Cargando...'}`}
      subtitle={isMantenimiento
        ? 'Configuración de presupuesto mensual por Línea de Negocio'
        : 'Configuración y asignación de presupuesto anual y mensual por equipo'
      }
      rightContent={
        <button className="btn btn--secondary" onClick={() => navigate('/presupuestos')}>
          Volver
        </button>
      }
    >
      {isMantenimiento
        ? <BudgetMantenimientoForm areaId={areaId} />
        : <BudgetEquiposForm areaId={areaId} />
      }
    </Layout>
  );
}
