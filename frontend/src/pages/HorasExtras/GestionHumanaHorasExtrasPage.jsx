import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Filter, Clock, DollarSign, Users, Moon,
  FileSpreadsheet, ChevronDown, ChevronRight, Edit2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import * as XLSX from 'xlsx';
import { NuevaJornadaModal } from './NuevaJornadaModal';

const formatCOP = (v) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0
}).format(v || 0);

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
};

const fmtH = (v) => `${(parseFloat(v) || 0).toFixed(2)}h`;
const fmtMin = (min) => {
  if (!min) return '0h 0min';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const getLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const getMinutosEsperados = (dia_semana, es_festivo) => {
  if (es_festivo || dia_semana === 0 || dia_semana === 6) return 0;
  if (dia_semana === 5) return 500; // 8h 20m para Viernes
  return 505; // 8h 25m para Lunes a Jueves
};

function KpiCard({ icon: Icon, label, value, color = '#6366f1' }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
      borderRadius: 12, padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <div style={{ background: `${color}20`, borderRadius: '50%', padding: '0.75rem' }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

export function GestionHumanaHorasExtrasPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateStr(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateStr(today));
  const [cargoFilter, setCargoFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [mostrarTodo, setMostrarTodo] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateStr(firstDay),
    hasta: getLocalDateStr(today),
    operario: '',
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['he-gestion-humana', appliedFilters],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/horas-extras/gestion-humana', { params });
      return res.data || [];
    },
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['he-operarios'],
    queryFn: async () => {
      const res = await api.get('/horas-extras/operarios');
      return res.data || [];
    },
  });

  // KPIs calculados
  const kpis = React.useMemo(() => {
    const ops = new Set();
    let totalExtras = 0, totalNoctMin = 0, totalGH = 0, totalLiq = 0;
    for (const r of rows) {
      ops.add(r.empleado_id);
      totalExtras += parseFloat(r.total_horas_extras) || 0;
      totalNoctMin += (parseInt(r.min_ord_nocturna) || 0) + (parseInt(r.min_extra_nocturna) || 0);
      totalGH += parseFloat(r.total_horas_gestion_humana) || 0;
      totalLiq += parseFloat(r.total_liquidado) || 0;
    }
    return { operarios: ops.size, totalExtras, totalNoctMin, totalGH, totalLiq };
  }, [rows]);

  const handleFilter = () => {
    setAppliedFilters({ desde: fechaInicio, hasta: fechaFin });
  };

  const filteredRows = React.useMemo(() => {
    let result = rows;
    
    if (cargoFilter) {
      result = result.filter(r => {
        const cargo = (r.cargo || '').toLowerCase();
        if (cargoFilter === 'operario') return cargo.includes('operario');
        if (cargoFilter === 'tecnico') return cargo.includes('tecnico') || cargo.includes('técnico');
        if (cargoFilter === 'administrativo') return cargo.includes('admin') || cargo.includes('auxiliar');
        return true;
      });
    }

    if (!mostrarTodo) {
      result = result.filter(r => {
        // Las manuales (sin remision) siempre se muestran
        if (!r.numero_remision) return true;
        
        // Fines de semana / Festivos siempre se muestran
        if (r.es_festivo || parseInt(r.dia_semana) === 0 || parseInt(r.dia_semana) === 6) return true;
        
        // Si tiene horas extras, mostrar
        if (parseFloat(r.total_horas_extras) > 0) return true;
        
        // Si el horario es diferente al estándar, mostrar
        const isViernes = parseInt(r.dia_semana) === 5;
        const finNormal = isViernes ? '16:10' : '16:15';
        const entrada = r.hora_entrada ? r.hora_entrada.substring(0, 5) : null;
        const salida = r.hora_salida ? r.hora_salida.substring(0, 5) : null;
        
        if (entrada !== '07:00' || salida !== finNormal) return true;
        
        // Si es una jornada perfectamente normal (07:00 a 16:15/10), se oculta
        return false;
      });
    }

    return result;
  }, [rows, cargoFilter, mostrarTodo]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const jornadasIncompletas = React.useMemo(() => {
    return filteredRows.filter(r => {
      const esp = getMinutosEsperados(parseInt(r.dia_semana), r.es_festivo);
      const ord = (parseInt(r.min_ord_diurna) || 0) + (parseInt(r.min_ord_nocturna) || 0);
      return esp > 0 && ord < esp;
    });
  }, [filteredRows]);

  const jornadasConMotivoFuera = React.useMemo(() => {
    return filteredRows.map(r => {
      if (!r.numero_remision) return null;

      let motivos = [];
      const entrada = r.hora_entrada ? r.hora_entrada.substring(0, 5) : null;
      const salida = r.hora_salida ? r.hora_salida.substring(0, 5) : null;

      if (r.es_festivo || parseInt(r.dia_semana) === 0 || parseInt(r.dia_semana) === 6) {
        motivos.push('Día no laborable ordinario');
      } else {
        const isViernes = parseInt(r.dia_semana) === 5;
        const finNormal = isViernes ? '16:10' : '16:15';
        
        if (entrada && (entrada < '07:00' || entrada > finNormal)) motivos.push(`Ingreso: ${entrada}`);
        if (salida && (salida > finNormal || salida < '07:00')) motivos.push(`Salida: ${salida}`);
      }

      if (motivos.length > 0) {
        return { ...r, motivoFueraHorario: motivos.join(', ') };
      }
      return null;
    }).filter(Boolean);
  }, [filteredRows]);

  const jornadasFueraDeHorario = React.useMemo(() => {
    return jornadasConMotivoFuera.filter(r => !(r.observacion || '').includes('[AUDITADO]'));
  }, [jornadasConMotivoFuera]);

  const handleToggleAuditoria = async (e, row) => {
    e.stopPropagation();
    try {
      const currentObs = row.observacion || '';
      let newObs;
      if (currentObs.includes('[AUDITADO]')) {
        newObs = currentObs.replace('[AUDITADO]', '').trim();
      } else {
        newObs = (currentObs + ' [AUDITADO]').trim();
      }
      
      // Llamada directa al API
      await api.patch(`/horas-extras/jornada/${row.id}/observacion`, { observacion: newObs });
      toast.success(newObs.includes('[AUDITADO]') ? 'Auditoría completada' : 'Auditoría removida');
      queryClient.invalidateQueries(['he-gestion-humana']);
    } catch (error) {
      toast.error('Error al actualizar auditoría');
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    if (!filteredRows.length) return;
    const data = filteredRows.map(r => ({
      Remisión: r.numero_remision,
      Operario: r.operario_nombre,
      Fecha: formatDate(r.fecha_trabajo),
      Día: DIAS[parseInt(r.dia_semana)],
      'HO': (parseInt(r.min_ord_diurna) || 0) / 60,
      'RN': (parseInt(r.min_ord_nocturna) || 0) / 60,
      'RDF': (parseInt(r.min_dom_diurna) || 0) / 60,
      'HED': (parseInt(r.min_extra_diurna) || 0) / 60,
      'HEN': (parseInt(r.min_extra_nocturna) || 0) / 60,
      'HEDDF': (parseInt(r.min_extra_dom_diurna) || 0) / 60,
      'HENDF': (parseInt(r.min_extra_dom_nocturna) || 0) / 60,
      'RNDF': (parseInt(r.min_dom_nocturna) || 0) / 60,
      'Total H. Extras': r.total_horas_extras,
      'Liquidación $': r.total_liquidado,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GestionHumana');
    XLSX.writeFile(wb, `GestionHumana_HE_${appliedFilters.desde}_${appliedFilters.hasta}.xlsx`);
    toast.success('Excel exportado');
  };

  return (
    <Layout
      title="Gestión Humana — Horas Extras"
      subtitle="Informe operativo · Incluye recargo nocturno ordinario (regla de duplicación)"
    >
      {/* KPIs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem', marginBottom: '1.5rem',
      }}>
        <KpiCard icon={Users} label="Empleados" value={kpis.operarios} color="#6366f1" />
        <KpiCard icon={Clock} label="H. Extras Totales" value={fmtH(kpis.totalExtras)} color="#f59e0b" />
        <KpiCard icon={DollarSign} label="Total Liquidación" value={formatCOP(kpis.totalLiq)} color="#10b981"  />
      </div>

      {/* Nota GH eliminada según solicitud */}

      {/* Filtros */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end',
        marginBottom: '1.5rem', background: 'var(--bg-elevated)',
        padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--border-color)',
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            <Calendar size={12} style={{ marginRight: 4 }} />Desde
          </label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
            className="input" style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            <Calendar size={12} style={{ marginRight: 4 }} />Hasta
          </label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
            className="input" style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            <Users size={12} style={{ marginRight: 4 }} />Empleado
          </label>
          <select value={cargoFilter} onChange={e => setCargoFilter(e.target.value)}
            className="input" style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: 180 }}>
            <option value="">Todos los Empleados</option>
            <option value="operario">Operarios</option>
            <option value="tecnico">Técnicos</option>
            <option value="administrativo">Administrativos</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleFilter}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}>
          <Filter size={15} /> Filtrar
        </button>
        <button className="btn btn-secondary" onClick={handleExportExcel}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}
          disabled={!filteredRows.length}>
          <FileSpreadsheet size={15} /> Excel
        </button>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={mostrarTodo} onChange={e => setMostrarTodo(e.target.checked)} />
            Mostrar turnos sin novedades
          </label>
          <button className="btn btn-primary" onClick={() => {
              setEditingRow(null);
              setIsModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}>
            + Nueva Jornada
          </button>
        </div>
      </div>

      {/* Alerta de jornadas incompletas */}
      {jornadasIncompletas.length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #f87171', borderRadius: 12, padding: '1rem 1.5rem',
          marginBottom: '1.5rem', color: '#991b1b', fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
             <span style={{ fontSize: '1.1rem' }}>⚠️</span> Alertas de Jornadas Incompletas
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {jornadasIncompletas.map(r => {
               const esp = getMinutosEsperados(parseInt(r.dia_semana), r.es_festivo);
               const ord = (parseInt(r.min_ord_diurna) || 0) + (parseInt(r.min_ord_nocturna) || 0);
               const faltan = esp - ord;
               return (
                 <li key={r.id} style={{ marginBottom: 4 }}>
                   <strong>{r.operario_nombre}</strong> el {formatDate(r.fecha_trabajo)} ({DIAS[parseInt(r.dia_semana)]}): le faltaron <strong>{fmtMin(faltan)}</strong> para completar su jornada ordinaria.
                 </li>
               );
            })}
          </ul>
        </div>
      )}

      {/* Alerta de jornadas fuera de horario (Naranja) */}
      {jornadasFueraDeHorario.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 12, padding: '1rem 1.5rem',
          marginBottom: '1.5rem', color: '#b45309', fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
             <span style={{ fontSize: '1.1rem' }}>🔔</span> Alertas: Jornadas fuera de horario (Requieren Auditoría)
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {jornadasFueraDeHorario.map(r => (
               <li key={`fuera-${r.id}`} style={{ marginBottom: 4 }}>
                 <strong>{r.operario_nombre}</strong> el {formatDate(r.fecha_trabajo)} ({DIAS[parseInt(r.dia_semana)]}): {r.motivoFueraHorario}.
               </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabla */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 12,
        border: '1px solid var(--border-color)', overflow: 'auto',
      }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Sin resultados para los filtros seleccionados
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-main)' }}>
                <th style={thStyle}></th>
                <th style={thStyle}>Remisión</th>
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Día</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Hora Ordinaria Diurna">HOD</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Recargo Nocturno (Ordinaria)">RN</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Recargo Dominical / Festivo">RDF</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Hora Extra Diurna">HED</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Hora Extra Nocturna">HEN</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Hora Extra Diurna Dom/Fest">HEDDF</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Hora Extra Nocturna Dom/Fest">HENDF</th>
                <th style={{ ...thStyle, textAlign: 'right' }} title="Recargo Nocturno Dom/Fest">RNDF</th>
                <th style={{ ...thStyle, textAlign: 'right', color: '#f59e0b' }}>Total H. Extras</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Liquidación $</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <React.Fragment key={row.id}>
                  <tr style={{
                    borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                    onClick={() => toggleRow(row.id)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tdStyle}>
                      {expandedRows[row.id]
                        ? <ChevronDown size={16} color="var(--text-muted)" />
                        : <ChevronRight size={16} color="var(--text-muted)" />}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {row.numero_remision}
                        {jornadasFueraDeHorario.some(j => j.id === row.id) && <span title="Fuera de horario">🔔</span>}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.operario_nombre}</td>
                    <td style={tdStyle}>{formatDate(row.fecha_trabajo)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: parseInt(row.dia_semana) === 0 || row.es_festivo ? '#fef2f2' : 'transparent',
                        color: parseInt(row.dia_semana) === 0 || row.es_festivo ? '#dc2626' : 'var(--text-primary)',
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem',
                      }}>
                        {DIAS[parseInt(row.dia_semana)] || '?'}
                        {row.es_festivo && ' 🎉'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: (getMinutosEsperados(parseInt(row.dia_semana), row.es_festivo) > 0 && ((parseInt(row.min_ord_diurna) || 0) + (parseInt(row.min_ord_nocturna) || 0)) < getMinutosEsperados(parseInt(row.dia_semana), row.es_festivo)) ? '#ef4444' : 'inherit', fontWeight: (getMinutosEsperados(parseInt(row.dia_semana), row.es_festivo) > 0 && ((parseInt(row.min_ord_diurna) || 0) + (parseInt(row.min_ord_nocturna) || 0)) < getMinutosEsperados(parseInt(row.dia_semana), row.es_festivo)) ? 600 : 'normal' }}>
                      {fmtH((parseInt(row.min_ord_diurna) || 0) / 60)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_ord_nocturna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_dom_diurna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_extra_diurna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_extra_nocturna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_extra_dom_diurna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_extra_dom_nocturna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH((parseInt(row.min_dom_nocturna) || 0) / 60)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                      {fmtH(row.total_horas_extras)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {formatCOP(row.total_liquidado)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRow(row);
                          setIsModalOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--primary)' }}
                        title="Editar Jornada"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                  {expandedRows[row.id] && (
                    <tr>
                      <td colSpan={100} style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(16,185,129,0.03)',
                        borderBottom: '2px solid var(--border-color)',
                      }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: '0.75rem', fontSize: '0.8rem',
                        }}>
                          <div><strong>Ingreso:</strong> {row.hora_entrada ? row.hora_entrada.substring(0,5) : '-'}</div>
                          <div><strong>Salida:</strong> {row.hora_salida ? row.hora_salida.substring(0,5) : '-'}</div>
                          <div><strong>Salario:</strong> {formatCOP(row.salario_mensual)}</div>
                          <div><strong>VHB:</strong> {formatCOP(row.valor_hora_base)}/h</div>
                          <div><strong>H. Trabajadas:</strong> {fmtH(row.horas_trabajadas)}</div>
                          <div><strong>Ord. Diurna:</strong> {fmtMin(row.min_ord_diurna)} <em style={{ color: '#94a3b8' }}>(no liquida)</em></div>
                          <div><strong>Ord. Nocturna:</strong> {fmtMin(row.min_ord_nocturna)} <span style={{ color: '#8b5cf6' }}>→ GH</span></div>
                          <div><strong>Extra Diurna:</strong> {fmtMin(row.min_extra_diurna)}</div>
                          <div><strong>Extra Nocturna:</strong> {fmtMin(row.min_extra_nocturna)}</div>
                          <div><strong>Dom/Fest Diurna:</strong> {fmtMin(row.min_dom_diurna)}</div>
                          <div><strong>Dom/Fest Nocturna:</strong> {fmtMin(row.min_dom_nocturna)}</div>
                          
                          {(() => {
                            const motivoData = jornadasConMotivoFuera.find(j => j.id === row.id);
                            if (!motivoData) return null;
                            const isAuditado = (row.observacion || '').includes('[AUDITADO]');
                            return (
                              <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: 8, background: isAuditado ? '#f0fdf4' : '#fffbeb', padding: '8px 12px', borderRadius: 6, border: isAuditado ? '1px solid #86efac' : '1px solid #fbbf24' }}>
                                <span style={{ color: isAuditado ? '#15803d' : '#b45309', fontWeight: 600, fontSize: '0.8rem' }}>
                                  {isAuditado ? '✅ Jornada Auditada. Motivo original: ' : '⚠️ Motivo de alerta: '}
                                  {motivoData.motivoFueraHorario}
                                </span>
                                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={isAuditado} 
                                    onChange={(e) => handleToggleAuditoria(e, row)}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                  />
                                  Marcar como auditada (Remover alerta)
                                </label>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {rows.length} registros · Solo lectura · Consume el mismo motor de cálculo
      </div>
      
      <NuevaJornadaModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingRow(null);
        }} 
        initialData={editingRow}
      />
    </Layout>
  );
}

const thStyle = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px', whiteSpace: 'nowrap' };
