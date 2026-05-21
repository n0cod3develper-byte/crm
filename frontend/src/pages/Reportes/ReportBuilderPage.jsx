import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import { useCubeQuery } from '@cubejs-client/react';
import { Layout } from '../../components/Layout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { GripVertical, X, LayoutTemplate, PieChart as PieChartIcon, Table as TableIcon, BarChart as BarChartIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- Componentes DND ---
const DraggableItem = ({ id, name, type }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${type}::${id}`,
    data: { id, name, type }
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 mb-2 bg-surface border border-color rounded cursor-grab active:cursor-grabbing hover:border-primary-500 transition-colors z-50 ${
        type === 'measure' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-green-500'
      }`}
    >
      <GripVertical size={14} className="text-muted" />
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
};

const DroppableArea = ({ id, title, items, onRemove, type }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef} 
      className={`p-4 rounded-xl border-2 transition-colors min-h-[120px] ${
        isOver ? 'border-primary-500 bg-primary-500/5' : 'border-dashed border-color bg-subtle/30'
      }`}
    >
      <h3 className="text-xs font-bold uppercase text-muted mb-3 flex items-center gap-2">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm
            ${type === 'measure' ? 'bg-blue-500' : 'bg-green-500'}
          `}>
            {item.name}
            <button onClick={() => onRemove(item.id)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
              <X size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <span className="text-sm text-muted italic">Arrastra campos aquí...</span>
        )}
      </div>
    </div>
  );
};

// --- Componente de Resultados ---
const ResultsDisplay = ({ query, chartType }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { resultSet, isLoading, error } = useCubeQuery(query, {
    skip: !query.measures?.length
  });

  if (!query.measures?.length) return (
    <div className="flex flex-col items-center justify-center h-[400px] text-muted border-2 border-dashed border-color rounded-xl bg-subtle/30">
      <LayoutTemplate size={48} className="mb-4 opacity-50" />
      <p>Agrega al menos una métrica para visualizar datos</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-[400px]">
      <div className="spinner mb-4" />
      <p className="text-sm text-muted">Consultando Cube.js...</p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
      <h4 className="font-bold mb-2">Error en la consulta</h4>
      <p className="text-sm font-mono whitespace-pre-wrap">{error.toString()}</p>
    </div>
  );

  if (!resultSet || !mounted) return null;

  const data = resultSet.chartPivot();
  const seriesNames = resultSet.seriesNames();
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (chartType === 'table') {
    return (
      <div className="overflow-x-auto bg-surface rounded-xl border border-color">
        <table className="w-full text-sm text-left">
          <thead className="bg-subtle text-xs uppercase text-muted">
            <tr>
              <th className="px-6 py-3">Categoría (X)</th>
              {seriesNames.map(s => <th key={s.key} className="px-6 py-3">{s.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-color hover:bg-subtle/30">
                <td className="px-6 py-4 font-medium">{row.x}</td>
                {seriesNames.map(s => <td key={s.key} className="px-6 py-4">{row[s.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="w-full bg-surface rounded-xl border border-color" style={{ height: 400, minHeight: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'pie' ? (
          <PieChart>
            <Pie data={data} dataKey={seriesNames[0]?.key || 'value'} nameKey="x" cx="50%" cy="50%" outerRadius={120} label>
              {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <XAxis dataKey="x" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} />
            <Tooltip 
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Legend />
            {seriesNames.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.title} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <XAxis dataKey="x" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} />
            <Tooltip 
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Legend />
            {seriesNames.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.title} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

// --- Main Page ---
export function ReportBuilderPage() {
  const [measures, setMeasures] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [chartType, setChartType] = useState('bar');

  const CATALOG = {
    measures: [
      { id: 'OrdenesTrabajo.count', name: 'Total OTs' },
      { id: 'Companies.count', name: 'Total Empresas' },
      { id: 'Equipos.count', name: 'Total Equipos' },
      { id: 'Inventario.totalStockValue', name: 'Valor Stock' },
      { id: 'Facturas.totalRevenue', name: 'Total Ingresos' }
    ],
    dimensions: [
      { id: 'Companies.name', name: 'Empresa: Nombre' },
      { id: 'OrdenesTrabajo.estado', name: 'OT: Estado' },
      { id: 'OrdenesTrabajo.tipoMantenimiento', name: 'OT: Tipo Mantenimiento' },
      { id: 'Companies.industry', name: 'Empresa: Industria' },
      { id: 'Companies.city', name: 'Empresa: Ciudad' },
      { id: 'Facturas.estado', name: 'Factura: Estado' },
      { id: 'OrdenesTrabajo.createdAt', name: 'OT: Fecha Creación' }
    ]
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const { id, name, type } = active.data.current;
    const dropArea = over.id;
    if (type === 'measure' && dropArea === 'measures-area') {
      if (!measures.find(m => m.id === id)) setMeasures([...measures, { id, name }]);
    } else if (type === 'dimension' && dropArea === 'dimensions-area') {
      if (!dimensions.find(d => d.id === id)) setDimensions([...dimensions, { id, name }]);
    } else {
      toast.error(`No puedes soltar un ${type} ahí.`);
    }
  };

  const removeMeasure = (id) => setMeasures(measures.filter(m => m.id !== id));
  const removeDimension = (id) => setDimensions(dimensions.filter(d => d.id !== id));

  const query = useMemo(() => ({
    measures: measures.map(m => m.id),
    dimensions: dimensions.map(d => d.id),
  }), [measures, dimensions]);

  return (
    <Layout title="Generador de Reportes (BI)">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
          
          {/* Sidebar Catálogo */}
          <div className="w-full lg:w-72 bg-surface rounded-2xl border border-color flex flex-col overflow-hidden">
            <div className="p-4 border-b border-color bg-subtle/50">
              <h2 className="font-bold">Catálogo de Datos</h2>
              <p className="text-xs text-muted">Arrastra los campos a tu reporte</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase text-blue-500 mb-3 tracking-wider">Métricas (Valores)</h3>
                {CATALOG.measures.map(m => (
                  <DraggableItem key={m.id} id={m.id} name={m.name} type="measure" />
                ))}
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase text-green-500 mb-3 tracking-wider">Dimensiones (Agrupación)</h3>
                {CATALOG.dimensions.map(d => (
                  <DraggableItem key={d.id} id={d.id} name={d.name} type="dimension" />
                ))}
              </div>
            </div>
          </div>

          {/* Workspace Principal */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DroppableArea id="measures-area" title="Valores (Métricas)" type="measure" items={measures} onRemove={removeMeasure} />
              <DroppableArea id="dimensions-area" title="Agrupar por (Dimensiones)" type="dimension" items={dimensions} onRemove={removeDimension} />
            </div>

            <div className="flex items-center justify-between p-2 bg-surface rounded-xl border border-color shrink-0">
              <div className="flex gap-2">
                <button onClick={() => setChartType('bar')} className={`p-2 rounded-lg transition-colors ${chartType === 'bar' ? 'bg-primary-500/10 text-primary-500' : 'hover:bg-subtle text-muted'}`}><BarChartIcon size={20}/></button>
                <button onClick={() => setChartType('line')} className={`p-2 rounded-lg transition-colors ${chartType === 'line' ? 'bg-primary-500/10 text-primary-500' : 'hover:bg-subtle text-muted'}`}><BarChartIcon size={20} className="rotate-90"/></button>
                <button onClick={() => setChartType('pie')} className={`p-2 rounded-lg transition-colors ${chartType === 'pie' ? 'bg-primary-500/10 text-primary-500' : 'hover:bg-subtle text-muted'}`}><PieChartIcon size={20}/></button>
                <div className="w-px h-6 bg-color my-auto mx-2"></div>
                <button onClick={() => setChartType('table')} className={`p-2 rounded-lg transition-colors ${chartType === 'table' ? 'bg-primary-500/10 text-primary-500' : 'hover:bg-subtle text-muted'}`}><TableIcon size={20}/></button>
              </div>
              <div className="text-xs font-mono text-muted bg-subtle px-3 py-1 rounded">Reporte dinámico</div>
            </div>

            <div className="flex-1 overflow-auto bg-surface rounded-2xl border border-color p-4">
              <ResultsDisplay query={query} chartType={chartType} />
            </div>
          </div>
        </div>
      </DndContext>
    </Layout>
  );
}
