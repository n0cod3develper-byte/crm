/**
 * TurnoSupervisorPage.jsx
 * Panel de administración y auditoría de Control de Turnos para supervisores y admins.
 * Ofrece pestañas de Monitoreo en Vivo y Aprobación de Horas Extras con filtros por fecha y estado.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Topbar } from '../../components/layout/Topbar';
import { PanelMonitoreo } from './components/PanelMonitoreo';
import { TablaHorasExtras } from './components/TablaHorasExtras';
import turnosService from '../../services/turnosService';
import api from '../../lib/api';
import { Calendar, Layers, Activity, ShieldAlert, CalendarRange, ArrowRight, User, Download } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Helpers de fecha ───────────────────────────────────────
function getToday() {
  return new Date().toISOString().split('T')[0];
}
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().split('T')[0];
}
function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function getMonthEnd() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}

export function TurnoSupervisorPage() {
  const queryClient = useQueryClient();
  
  // Filtros monitoreo (fecha única)
  const [fecha, setFecha] = useState(getToday);
  const [estado, setEstado] = useState('all');
  
  // Filtros auditoría (rango de fechas)
  const [fechaDesde, setFechaDesde] = useState(getWeekStart);
  const [fechaHasta, setFechaHasta] = useState(getToday);

  // Filtro de técnico
  const [empleadoId, setEmpleadoId] = useState('all');

  // Pestañas: 'monitoreo' | 'auditoria'
  const [activeTab, setActiveTab] = useState('monitoreo');

  // Obtener empleados para el filtro de técnicos
  const { data: employeesResponse } = useQuery({
    queryKey: ['employeesFilterList'],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params: { limit: 200 } });
      return data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const tecnicos = useMemo(() => {
    if (!Array.isArray(employeesResponse)) return [];
    return [...employeesResponse].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [employeesResponse]);

  // Consulta monitoreo (turnos de un día)
  const { data: turnosMonitoreo = [], isLoading: loadingMonitoreo } = useQuery({
    queryKey: ['turnosList', fecha, estado, empleadoId],
    queryFn: () => turnosService.listarTurnos({ 
      fecha, 
      estado,
      empleado_id: empleadoId !== 'all' ? empleadoId : undefined
    }),
    refetchInterval: activeTab === 'monitoreo' ? 60000 : false,
    staleTime: 10000,
    enabled: activeTab === 'monitoreo',
  });

  // Consulta auditoría (rango de fechas)
  const { data: turnosAuditoria = [], isLoading: loadingAuditoria } = useQuery({
    queryKey: ['turnosAuditoria', fechaDesde, fechaHasta, empleadoId],
    queryFn: () => turnosService.listarTurnos({
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      empleado_id: empleadoId !== 'all' ? empleadoId : undefined,
      limit: 200,
    }),
    staleTime: 15000,
    enabled: activeTab === 'auditoria',
  });

  // Resumen semanal de horas extras (para pestaña auditoría)
  const { data: resumenSemanal = [] } = useQuery({
    queryKey: ['resumenSemanal'],
    queryFn: () => turnosService.resumenSemana(),
    staleTime: 60000,
    enabled: activeTab === 'auditoria',
  });

  // Función para exportar a CSV compatible con Excel
  const exportToExcel = useCallback(() => {
    const turnosToExport = activeTab === 'monitoreo' ? turnosMonitoreo : turnosAuditoria;
    if (!turnosToExport || turnosToExport.length === 0) {
      toast.error('No hay datos para exportar con los filtros actuales.');
      return;
    }

    const formatHours = (mins) => {
      if (mins == null) return '0.00';
      return (mins / 60).toFixed(2);
    };

    const cleanText = (text) => {
      if (text == null) return '';
      return String(text).replace(/"/g, '""').replace(/\r?\n|\r/g, ' ');
    };

    let headers = [];
    let rows = [];

    if (activeTab === 'monitoreo') {
      headers = [
        'Tecnico',
        'Fecha',
        'Inicio Turno',
        'Fin Turno',
        'Estado',
        'Tiempo Transcurrido (Horas)',
        'Horas Extras (Horas)',
        'Alerta Limite Legal',
        'Cant. Servicios'
      ];
      
      rows = turnosToExport.map(t => [
        t.nombre_tecnico,
        t.fecha_turno,
        t.inicio_turno ? new Date(t.inicio_turno).toLocaleTimeString() : '--',
        t.fin_turno ? new Date(t.fin_turno).toLocaleTimeString() : '--',
        t.estado,
        formatHours(t.tiempo_total_min),
        formatHours(t.minutos_extras),
        t.alerta_limite_legal ? 'SI' : 'NO',
        t.total_servicios || 0
      ]);
    } else {
      headers = [
        'Tecnico',
        'Fecha',
        'Inicio Turno',
        'Fin Turno',
        'Estado',
        'Horas Totales',
        'Horas Extras Diurnas',
        'Horas Extras Nocturnas',
        'Horas Extras Totales',
        'Tarifa Hora',
        'Costo Extras Base',
        'Recargo Diurno (25%)',
        'Recargo Nocturno (75%)',
        'Costo Total Extras',
        'Aprobado',
        'Aprobado Por',
        'Fecha Aprobacion',
        'Observaciones'
      ];

      rows = turnosToExport.map(t => {
        const costoBase = Number(t.costo_extras) || 0;
        const recDiurno = Number(t.costo_recargo_diurno) || 0;
        const recNocturno = Number(t.costo_recargo_nocturno) || 0;
        const costoTotal = costoBase + recDiurno + recNocturno;
        
        const aprobador = t.aprobador_nombre 
          ? `${t.aprobador_nombre} ${t.aprobador_apellido || ''}`.trim()
          : t.aprobador_email || '';

        return [
          t.nombre_tecnico,
          t.fecha_turno,
          t.inicio_turno ? new Date(t.inicio_turno).toLocaleString() : '--',
          t.fin_turno ? new Date(t.fin_turno).toLocaleString() : '--',
          t.estado,
          t.horas_totales || '0.00',
          t.horas_extras_diurnas || '0.00',
          t.horas_extras_nocturnas || '0.00',
          t.horas_extras || '0.00',
          t.hourly_rate || '0',
          costoBase,
          recDiurno,
          recNocturno,
          costoTotal,
          t.aprobado_por ? 'SI' : 'PENDIENTE',
          aprobador,
          t.aprobado_en ? new Date(t.aprobado_en).toLocaleString() : '',
          t.observaciones || ''
        ];
      });
    }

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${cleanText(val)}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const filename = `turnos_${activeTab === 'monitoreo' ? 'monitoreo' : 'auditoria'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Archivo exportado correctamente.');
  }, [activeTab, turnosMonitoreo, turnosAuditoria]);

  // Mutación para aprobar horas extras
  const approveMutation = useMutation({
    mutationFn: ({ turnoId, data }) => turnosService.aprobarExtras(turnoId, data),
    onSuccess: () => {
      toast.success('Horas extras aprobadas para nómina.');
      queryClient.invalidateQueries({ queryKey: ['turnosList'] });
      queryClient.invalidateQueries({ queryKey: ['turnosAuditoria'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al aprobar horas extras');
    }
  });

  // Quick-select handlers para auditoría
  const setRangeToday = useCallback(() => {
    setFechaDesde(getToday());
    setFechaHasta(getToday());
  }, []);
  const setRangeWeek = useCallback(() => {
    setFechaDesde(getWeekStart());
    setFechaHasta(getToday());
  }, []);
  const setRangeMonth = useCallback(() => {
    setFechaDesde(getMonthStart());
    setFechaHasta(getMonthEnd());
  }, []);

  // Estilo botón quick-select
  const quickBtnStyle = (isActive) => ({
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    border: `1px solid ${isActive ? 'var(--clr-primary-500)' : 'var(--border-color)'}`,
    borderRadius: 'var(--radius-sm)',
    background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-surface)',
    color: isActive ? 'var(--clr-primary-500)' : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    whiteSpace: 'nowrap',
  });

  const todayStr = getToday();
  const isToday = fechaDesde === todayStr && fechaHasta === todayStr;
  const isWeek = fechaDesde === getWeekStart() && !isToday;
  const isMonth = fechaDesde === getMonthStart() && !isWeek && !isToday;

  return (
    <div className="app-layout">
      <Topbar 
        title="Supervisor de Turnos" 
        subtitle="Monitoreo de operarios en campo y aprobación de horas extras" 
      />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Barra de Filtros */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-app)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setActiveTab('monitoreo')}
              style={{
                padding: '6px 16px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: activeTab === 'monitoreo' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'monitoreo' ? 'var(--clr-primary-500)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Activity size={14} /> Monitoreo en Vivo
            </button>
            <button
              onClick={() => setActiveTab('auditoria')}
              style={{
                padding: '6px 16px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: activeTab === 'auditoria' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'auditoria' ? 'var(--clr-primary-500)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all var(--transition-fast)'
              }}
            >
              <ShieldAlert size={14} /> Auditoría Horas Extras
            </button>
          </div>

          {/* Filtros a la derecha — condicional por pestaña */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filtro de Técnico */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <select
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                style={{
                  padding: '6px 8px 6px 1.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-xs)',
                  width: '180px'
                }}
              >
                <option value="all">Todos los técnicos</option>
                {tecnicos.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} {emp.position ? `(${emp.position})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Exportar */}
            <button
              onClick={exportToExcel}
              style={{
                padding: '6px 12px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-app)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <Download size={14} /> Exportar Excel
            </button>

            {/* Separador visual */}
            <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

            {activeTab === 'monitoreo' ? (
              /* ── Filtro de fecha única para Monitoreo ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                  <Calendar size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={{
                      padding: '6px 8px 6px 1.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                  <Layers size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    style={{
                      padding: '6px 8px 6px 1.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)',
                      width: '140px'
                    }}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="ACTIVO">Activos (En turno)</option>
                    <option value="CERRADO">Cerrados (Terminados)</option>
                    <option value="CERRADO_AUTO">Cerrados Automáticos</option>
                  </select>
                </div>
              </>
            ) : (
              /* ── Filtro de rango de fechas para Auditoría ── */
              <>
                {/* Quick-select buttons */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button onClick={setRangeToday} style={quickBtnStyle(isToday)}>Hoy</button>
                  <button onClick={setRangeWeek} style={quickBtnStyle(isWeek)}>Esta semana</button>
                  <button onClick={setRangeMonth} style={quickBtnStyle(isMonth)}>Este mes</button>
                </div>

                {/* Separador visual */}
                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                {/* Rango de fechas */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <CalendarRange size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="date"
                    value={fechaDesde}
                    max={fechaHasta}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)'
                    }}
                  />
                  <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="date"
                    value={fechaHasta}
                    min={fechaDesde}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)'
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contenido según pestaña */}
        {activeTab === 'monitoreo' ? (
          <PanelMonitoreo turnos={turnosMonitoreo} loading={loadingMonitoreo} />
        ) : (
          <TablaHorasExtras 
            turnos={turnosAuditoria} 
            onApprove={approveMutation.mutateAsync} 
            isApproving={approveMutation.isPending}
            resumenSemanal={resumenSemanal}
          />
        )}
      </main>
    </div>
  );
}

export default TurnoSupervisorPage;
