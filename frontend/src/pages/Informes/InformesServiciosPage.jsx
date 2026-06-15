import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { Calendar, Filter, PieChart as PieChartIcon, BarChart3, AlertCircle, RefreshCw, Truck, TrendingUp, DollarSign } from 'lucide-react';
import { KpiHorasOperativas } from './KpiHorasOperativas';
import { 
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  ComposedChart, Line
} from 'recharts';

// Paleta de colores Premium
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value || 0);
}

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{payload[0].name}</p>
        <p style={{ margin: 0, color: payload[0].payload.fill, fontWeight: 'bold' }}>
          {formatCOP(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: 0, color: '#6366f1', fontWeight: 'bold' }}>
          Total Ventas: {formatCOP(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomSalesVsBudgetTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const salesObj = payload.find(p => p.dataKey === 'sales');
    const budgetObj = payload.find(p => p.dataKey === 'budget');
    const sales = salesObj ? parseFloat(salesObj.value || 0) : 0;
    const budget = budgetObj ? parseFloat(budgetObj.value || 0) : 0;
    const difference = sales - budget;
    const compliance = budget > 0 ? (sales / budget) * 100 : 0;
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>{label}</p>
        <p style={{ margin: 0, color: '#6366f1', fontWeight: 600 }}>
          Ventas Reales: {formatCOP(sales)}
        </p>
        <p style={{ margin: 0, color: '#10b981', fontWeight: 600 }}>
          Presupuesto: {formatCOP(budget)}
        </p>
        <p style={{ margin: '5px 0 0 0', color: difference >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, borderTop: '1px solid var(--border-color)', paddingTop: '5px' }}>
          Diferencia: {difference >= 0 ? '+' : ''}{formatCOP(difference)} ({compliance.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

export function InformesServiciosPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); // Por defecto el mes actual

  const [fechaInicio, setFechaInicio] = useState(getLocalDateString(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateString(today));

  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateString(firstDay),
    hasta: getLocalDateString(today)
  });

  const { data: dataPie, isLoading: isLoadingPie, error: errorPie } = useQuery({
    queryKey: ['informesServiciosPie', appliedFilters.desde, appliedFilters.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/ventas-linea-negocio', { 
        params: { fecha_inicio: appliedFilters.desde, fecha_fin: appliedFilters.hasta } 
      });
      return res.data.map(item => ({
        name: item.linea_negocio,
        value: parseFloat(item.total_ventas || 0)
      }));
    }
  });

  const { data: dataBar, isLoading: isLoadingBar, error: errorBar } = useQuery({
    queryKey: ['informesServiciosBar', appliedFilters.desde, appliedFilters.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/ventas-mensuales', { 
        params: { fecha_inicio: appliedFilters.desde, fecha_fin: appliedFilters.hasta } 
      });
      return res.data.map(item => ({
        mes: item.mes,
        total: parseFloat(item.total_ventas || 0)
      }));
    }
  });

  const { data: dataEquipos, isLoading: isLoadingEquipos, error: errorEquipos } = useQuery({
    queryKey: ['informesServiciosEquipos', appliedFilters.desde, appliedFilters.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/ventas-equipos', { 
        params: { fecha_inicio: appliedFilters.desde, fecha_fin: appliedFilters.hasta } 
      });
      return res.data.map(item => ({
        equipo: item.equipo_nombre,
        total: parseFloat(item.total_ventas || 0)
      }));
    }
  });

  const [selectedEquipoId, setSelectedEquipoId] = useState('all');

  const { data: allEquipos } = useQuery({
    queryKey: ['equipos', 'all-informes'],
    queryFn: async () => {
      const res = await api.get('/equipos/by-company/cargar');
      return res.data.data || [];
    }
  });

  const { data: dataSalesVsBudget, isLoading: isLoadingSalesVsBudget, error: errorSalesVsBudget } = useQuery({
    queryKey: ['salesVsBudget', selectedEquipoId, appliedFilters.desde, appliedFilters.hasta],
    queryFn: async () => {
      if (!selectedEquipoId) return null;
      const res = await api.get('/informes/servicios/sales-vs-budget', {
        params: {
          equipment_id: selectedEquipoId,
          date_from: appliedFilters.desde,
          date_to: appliedFilters.hasta
        }
      });
      return res.data;
    },
    enabled: !!selectedEquipoId
  });

  useEffect(() => {
    if (allEquipos && allEquipos.length > 0 && !selectedEquipoId) {
      setSelectedEquipoId('all');
    }
  }, [allEquipos, selectedEquipoId]);

  const handleApplyFilter = () => {
    setAppliedFilters({ desde: fechaInicio, hasta: fechaFin });
  };

  const isLoading = isLoadingPie || isLoadingBar || isLoadingEquipos;
  const hasError = errorPie || errorBar || errorEquipos;

  return (
    <Layout
      title="Informes Analíticos - Servicios"
      subtitle="Métricas y estadísticas del rendimiento de servicios prestados"
    >
      {/* ── Filtros ── */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Inicio
            </label>
            <input
              type="date"
              className="input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Fin
            </label>
            <input
              type="date"
              className="input"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>

          <button className="btn btn--primary" onClick={handleApplyFilter} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
            <Filter size={15} /> Generar Reporte
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state" style={{ minHeight: '400px' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: '1rem' }}>Procesando analíticas...</p>
        </div>
      ) : hasError ? (
        <div className="card" style={{ border: '1px solid var(--clr-danger-500)', background: 'var(--clr-danger-500)0b', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--clr-danger-500)', marginBottom: '1rem' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--clr-danger-400)', marginBottom: '0.5rem' }}>Error en Consulta</h3>
          <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>No se pudieron recuperar los datos de los gráficos.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* KPIs de Horas Trabajadas (Nivel Superior) */}
          <KpiHorasOperativas appliedFilters={appliedFilters} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
            
            {/* Gráfico y KPIs - Ventas vs Presupuesto */}
          <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '8px' }}>
                  <TrendingUp size={20} color="#6366f1" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Presupuesto vs. Ventas Reales por Equipo</h3>
                  <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>Compara el cumplimiento de la meta mensual por equipo/máquina</p>
                </div>
              </div>
              
              <div style={{ minWidth: '280px' }}>
                <select 
                  className="input" 
                  value={selectedEquipoId} 
                  onChange={(e) => setSelectedEquipoId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Seleccione un equipo --</option>
                  <option value="all">-- Todos los equipos --</option>
                  {allEquipos?.map(e => (
                    <option key={e.id} value={e.id}>{e.marca} - Serie: {e.serie}</option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedEquipoId ? (
              <div className="empty-state" style={{ height: 350, border: 'none' }}>
                <p>Seleccione un equipo para ver el comparativo de presupuesto y ventas.</p>
              </div>
            ) : isLoadingSalesVsBudget ? (
              <div className="empty-state" style={{ height: 350, border: 'none' }}>
                <div className="spinner" />
                <p className="text-muted" style={{ marginTop: '1rem' }}>Cargando datos comparativos...</p>
              </div>
            ) : errorSalesVsBudget ? (
              <div className="empty-state" style={{ height: 350, border: 'none', color: 'var(--clr-danger-500)' }}>
                <AlertCircle size={24} />
                <p style={{ marginTop: '0.5rem' }}>Error al cargar datos comparativos de presupuesto.</p>
              </div>
            ) : dataSalesVsBudget && dataSalesVsBudget.data && dataSalesVsBudget.data.length > 0 ? (() => {
              const totalSales = dataSalesVsBudget.data.reduce((sum, item) => sum + parseFloat(item.sales || 0), 0);
              const totalBudget = dataSalesVsBudget.data.reduce((sum, item) => sum + parseFloat(item.budget || 0), 0);
              const difference = totalSales - totalBudget;
              const compliance = totalBudget > 0 ? (totalSales / totalBudget) * 100 : 0;
              
              let complianceColor = '#ef4444'; // Red
              if (compliance >= 100) {
                complianceColor = '#10b981'; // Green
              } else if (compliance >= 80) {
                complianceColor = '#f59e0b'; // Yellow/Orange
              }

              return (
                <div>
                  {/* KPIs Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Ventas Reales</span>
                        <DollarSign size={16} color="#6366f1" />
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCOP(totalSales)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Presupuesto Meta</span>
                        <DollarSign size={16} color="#10b981" />
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCOP(totalBudget)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Cumplimiento</span>
                        <TrendingUp size={16} style={{ color: complianceColor }} />
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: complianceColor }}>
                        {compliance.toFixed(1)}%
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Desviación</span>
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: difference >= 0 ? '#10b981' : '#ef4444' }}>
                        {difference >= 0 ? '+' : ''}{formatCOP(difference)}
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={dataSalesVsBudget.data}
                        margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} dy={10} />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'var(--text-muted)' }} 
                          tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                        />
                        <BarTooltip content={<CustomSalesVsBudgetTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                        <Legend verticalAlign="top" height={36} />
                        <Bar name="Ventas Reales" dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                        <Line name="Presupuesto Meta" type="monotone" dataKey="budget" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })() : (
              <div className="empty-state" style={{ height: 350, border: 'none' }}>
                <p>No se encontraron datos comparativos de presupuesto o ventas reales en el rango de fechas seleccionado.</p>
              </div>
            )}
          </div>

          {/* Gráfico de Torta */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '8px' }}>
                <PieChartIcon size={20} color="#6366f1" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Ventas por Línea de Negocio</h3>
            </div>
            
            {dataPie && dataPie.length > 0 ? (
              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {dataPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip content={<CustomPieTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ height: 350, border: 'none' }}>
                <p>No hay datos suficientes para el período seleccionado.</p>
              </div>
            )}
          </div>

          {/* Gráfico de Barras */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px' }}>
                <BarChart3 size={20} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Ventas Totales Mensuales</h3>
            </div>
            
            {dataBar && dataBar.length > 0 ? (
              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dataBar}
                    margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)' }} 
                      tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                    />
                    <BarTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar 
                      dataKey="total" 
                      fill="#6366f1" 
                      radius={[6, 6, 0, 0]}
                      animationBegin={0}
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ height: 350, border: 'none' }}>
                <p>No hay datos suficientes para el período seleccionado.</p>
              </div>
            )}
          </div>

          {/* Gráfico de Barras - Equipos */}
          <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '8px' }}>
                <Truck size={20} color="#f59e0b" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Ventas por Equipo / Máquina</h3>
            </div>
            
            {dataEquipos && dataEquipos.length > 0 ? (
              <div style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dataEquipos}
                    margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis 
                      dataKey="equipo" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
                      angle={-45}
                      textAnchor="end"
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)' }} 
                      tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                    />
                    <BarTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }} />
                    <Bar 
                      dataKey="total" 
                      fill="#f59e0b" 
                      radius={[6, 6, 0, 0]}
                      animationBegin={0}
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ height: 350, border: 'none' }}>
                <p>No hay datos suficientes para el período seleccionado.</p>
              </div>
            )}
          </div>

        </div>
      </div>
      )}
    </Layout>
  );
}
