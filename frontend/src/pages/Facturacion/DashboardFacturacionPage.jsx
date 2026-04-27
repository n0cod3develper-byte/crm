import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Receipt, 
  Clock, 
  FileCheck, 
  TrendingUp, 
  ArrowRight,
  Building2,
  AlertCircle
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils/formatters';

export const DashboardFacturacionPage = () => {
  const navigate = useNavigate();
  
  const { data: resumen, isLoading } = useQuery({
    queryKey: ['resumenCartera'],
    queryFn: facturacionApi.getResumenCartera
  });

  const { data: otsPendientes } = useQuery({
    queryKey: ['otsPendientes'],
    queryFn: () => facturacionApi.getOtsPendientes({ limit: 10 })
  });

  const stats = [
    {
      label: 'OTs por Facturar',
      value: resumen?.data?.reduce((acc, curr) => acc + parseInt(curr.ots_por_facturar), 0) || 0,
      icon: Clock,
      color: 'var(--accent-orange)',
      bg: 'rgba(245, 158, 11, 0.1)'
    },
    {
      label: 'Total Pendiente',
      value: formatCurrency(resumen?.data?.reduce((acc, curr) => acc + parseFloat(curr.valor_pendiente_facturar), 0) || 0),
      icon: TrendingUp,
      color: 'var(--accent-blue)',
      bg: 'rgba(59, 130, 246, 0.1)'
    },
    {
      label: 'OTs Facturadas',
      value: resumen?.data?.reduce((acc, curr) => acc + parseInt(curr.ots_facturadas), 0) || 0,
      icon: FileCheck,
      color: 'var(--accent-green)',
      bg: 'rgba(34, 197, 94, 0.1)'
    },
    {
      label: 'Valor Facturado Total',
      value: formatCurrency(resumen?.data?.reduce((acc, curr) => acc + parseFloat(curr.valor_facturado_total), 0) || 0),
      icon: Receipt,
      color: 'var(--accent-purple)',
      bg: 'rgba(168, 85, 247, 0.1)'
    }
  ];

  if (isLoading) return (
    <Layout title="Dashboard de Facturación">
      <div className="flex items-center justify-center py-20">
        <div className="spinner h-12 w-12" />
      </div>
    </Layout>
  );

  return (
    <Layout title="Dashboard de Facturación">
      <div className="space-y-8 animate-in fade-in duration-700">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="card-premium p-6 flex items-center gap-4 hover-scale">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: stat.bg, color: stat.color }}
              >
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Cartera por Empresa */}
          <div className="card-premium overflow-hidden">
            <div className="p-6 border-b border-color flex justify-between items-center bg-subtle">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-accent" />
                <h3 className="font-bold text-lg">Cartera por Empresa</h3>
              </div>
              <button 
                onClick={() => navigate('/facturacion/pendientes')}
                className="btn-ghost flex items-center gap-1 text-accent hover:underline"
              >
                Ver todas <ArrowRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-subtle/50 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-6 py-4 text-left">Empresa</th>
                    <th className="px-6 py-4 text-center">OTs Pend.</th>
                    <th className="px-6 py-4 text-right">Valor Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-color">
                  {resumen?.data?.slice(0, 8).map((emp, i) => (
                    <tr 
                      key={i} 
                      className="hover:bg-subtle/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/facturacion/pendientes?empresa_id=${emp.empresa_id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold">{emp.name}</div>
                        <div className="text-xs text-muted">NIT: {emp.nit}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 font-bold text-xs">
                          {emp.ots_por_facturar}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-accent">
                        {formatCurrency(emp.valor_pendiente_facturar)}
                      </td>
                    </tr>
                  ))}
                  {(!resumen?.data || resumen.data.length === 0) && (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-muted">
                        No hay cartera pendiente de facturación.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* OTs Recientes sin Facturar */}
          <div className="card-premium overflow-hidden">
            <div className="p-6 border-b border-color flex justify-between items-center bg-subtle">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-accent" />
                <h3 className="font-bold text-lg">OTs Antiguas por Facturar</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <AlertCircle size={14} className="text-orange-500" />
                Prioridad Crítica
              </div>
            </div>
            <div className="p-4 space-y-4">
              {otsPendientes?.data?.slice(0, 6).map((ot, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-4 rounded-xl border border-color bg-subtle/20 hover:border-accent transition-all group cursor-pointer"
                  onClick={() => navigate(`/mantenimiento/${ot.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${ot.dias_desde_liquidacion > 30 ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-subtle text-muted'}`}>
                      {ot.dias_desde_liquidacion}d
                    </div>
                    <div>
                      <div className="font-bold group-hover:text-accent transition-colors">{ot.consecutivo}</div>
                      <div className="text-xs text-muted">{ot.empresa_nombre}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(ot.total)}</div>
                    <div className="text-[10px] uppercase text-muted">Liquidada el {new Date(ot.fecha_liquidacion).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              {(!otsPendientes?.data || otsPendientes.data.length === 0) && (
                <div className="text-center py-12 text-muted">
                  No hay órdenes de trabajo pendientes de facturar.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
};
