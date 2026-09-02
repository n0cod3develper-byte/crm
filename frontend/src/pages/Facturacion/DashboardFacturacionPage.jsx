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

  /* ── KPIs primarios: acción requerida ─────────────────────── */
  const statsPrimary = [
    {
      label: 'OTs por Facturar',
      value: resumen?.data?.reduce((acc, curr) => acc + parseInt(curr.ots_por_facturar), 0) || 0,
      icon: Clock,
      accent: 'amber',
    },
    {
      label: 'Total Pendiente',
      value: formatCurrency(resumen?.data?.reduce((acc, curr) => acc + parseFloat(curr.valor_pendiente_facturar), 0) || 0),
      icon: TrendingUp,
      accent: 'indigo',
    },
  ];

  /* ── KPIs secundarios: historial / logros ─────────────────── */
  const statsSecondary = [
    {
      label: 'OTs Facturadas',
      value: resumen?.data?.reduce((acc, curr) => acc + parseInt(curr.ots_facturadas), 0) || 0,
      icon: FileCheck,
      accent: 'emerald',
    },
    {
      label: 'Valor Facturado Total',
      value: formatCurrency(resumen?.data?.reduce((acc, curr) => acc + parseFloat(curr.valor_facturado_total), 0) || 0),
      icon: Receipt,
      accent: 'violet',
    },
  ];

  /* ── Badge de días por umbral de urgencia ─────────────────── */
  const getDaysClass = (dias) => {
    if (dias > 30) return 'billing-ot-days billing-ot-days--critical';
    if (dias > 15) return 'billing-ot-days billing-ot-days--warning';
    return 'billing-ot-days';
  };

  /* ── Loading ──────────────────────────────────────────────── */
  if (isLoading) return (
    <Layout title="Dashboard de Facturación">
      <div className="billing-loading">
        <div className="spinner" style={{ width: '3rem', height: '3rem' }} />
      </div>
    </Layout>
  );

  return (
    <Layout title="Dashboard de Facturación">
      <div className="billing-dashboard animate-in fade-in">

        {/* ── KPI Grid 2×2 ────────────────────────────────────── */}
        <div className="billing-kpi-grid">

          {/* Fila superior: KPIs de acción requerida (más prominentes) */}
          {statsPrimary.map((stat, i) => (
            <div
              key={i}
              className={`billing-kpi-card billing-kpi-card--primary billing-kpi-card--${stat.accent}`}
            >
              <div className="billing-kpi-icon-wrap">
                <stat.icon size={22} />
              </div>
              <div className="billing-kpi-content">
                <p className="billing-kpi-label">{stat.label}</p>
                <p className="billing-kpi-value billing-kpi-value--primary">{stat.value}</p>
              </div>
            </div>
          ))}

          {/* Fila inferior: KPIs de historial (más compactos) */}
          {statsSecondary.map((stat, i) => (
            <div
              key={i}
              className={`billing-kpi-card billing-kpi-card--secondary billing-kpi-card--${stat.accent}`}
            >
              <div className="billing-kpi-icon-wrap billing-kpi-icon-wrap--sm">
                <stat.icon size={18} />
              </div>
              <div className="billing-kpi-content">
                <p className="billing-kpi-label">{stat.label}</p>
                <p className="billing-kpi-value billing-kpi-value--secondary">{stat.value}</p>
              </div>
            </div>
          ))}

        </div>

        {/* ── Secciones: Cartera + OTs ─────────────────────────── */}
        <div className="billing-sections-grid">

          {/* ── Cartera por Empresa ─────────────────────────────── */}
          <div className="card-premium billing-panel">
            <div className="billing-section-header">
              <div className="billing-section-title">
                <Building2 size={18} className="billing-section-icon" />
                <h3>Cartera por Empresa</h3>
              </div>
              <button
                onClick={() => navigate('/facturacion/pendientes')}
                className="billing-link-btn"
              >
                Ver todas <ArrowRight size={13} />
              </button>
            </div>

            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th className="billing-th billing-th--left">Empresa</th>
                    <th className="billing-th billing-th--center">OTs Pend.</th>
                    <th className="billing-th billing-th--right">Valor Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen?.data?.slice(0, 8).map((emp, i) => (
                    <tr
                      key={i}
                      className="billing-table-row"
                      onClick={() => navigate(`/facturacion/pendientes?empresa_id=${emp.empresa_id}`)}
                    >
                      <td className="billing-td">
                        <div className="billing-company-name">{emp.name}</div>
                        <div className="billing-company-nit">NIT: {emp.nit}</div>
                      </td>
                      <td className="billing-td billing-td--center">
                        <span className="billing-ots-badge">{emp.ots_por_facturar}</span>
                      </td>
                      <td className="billing-td billing-td--right billing-amount">
                        {formatCurrency(emp.valor_pendiente_facturar)}
                      </td>
                    </tr>
                  ))}
                  {(!resumen?.data || resumen.data.length === 0) && (
                    <tr>
                      <td colSpan="3" className="billing-empty">
                        No hay cartera pendiente de facturación.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── OTs Antiguas por Facturar ────────────────────────── */}
          <div className="card-premium billing-panel">
            <div className="billing-section-header">
              <div className="billing-section-title">
                <Clock size={18} className="billing-section-icon" />
                <h3>OTs Antiguas por Facturar</h3>
              </div>
              <span className="billing-priority-badge">
                <AlertCircle size={12} />
                Prioridad Crítica
              </span>
            </div>

            <div className="billing-ot-list">
              {otsPendientes?.data?.slice(0, 6).map((ot, i) => (
                <div
                  key={i}
                  className="billing-ot-row"
                  onClick={() => navigate(`/mantenimiento/${ot.id}`)}
                >
                  {/* Col 1: Badge de días */}
                  <div className={getDaysClass(ot.dias_desde_liquidacion)}>
                    {ot.dias_desde_liquidacion}d
                  </div>

                  {/* Col 2: Número OT + Empresa */}
                  <div className="billing-ot-info">
                    <div className="billing-ot-number">{ot.consecutivo}</div>
                    <div className="billing-ot-company">{ot.empresa_nombre}</div>
                  </div>

                  {/* Col 3: Monto + Fecha */}
                  <div className="billing-ot-amount-wrap">
                    <div className="billing-ot-amount">{formatCurrency(ot.total)}</div>
                    <div className="billing-ot-date">
                      Liq. {new Date(ot.fecha_liquidacion).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Col 4: Flecha hover */}
                  <ArrowRight size={14} className="billing-ot-arrow" />
                </div>
              ))}
              {(!otsPendientes?.data || otsPendientes.data.length === 0) && (
                <div className="billing-empty">
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
