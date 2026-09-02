import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Topbar } from '../../components/layout/Topbar';
import { 
  FileText, Upload, Calendar, AlertTriangle, CheckCircle, 
  Layers, BarChart2, DollarSign, ArrowRight 
} from 'lucide-react';
import api from '../../lib/api';
import { formatCurrency } from '../../utils/formatters';
import ImportarModal from './ImportarModal';
import ClasificacionCuentasTab from './ClasificacionCuentasTab';

export function ContabilidadDashboardPage() {
  const [activeTab, setActiveTab] = useState('balance'); // 'balance' | 'resultados' | 'clasificacion'
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // 1. List Periods
  const { data: periodos = [], isLoading: isLoadingPeriodos, refetch: refetchPeriodos } = useQuery({
    queryKey: ['contabilidad-periodos'],
    queryFn: async () => {
      const res = await api.get('/contabilidad/periodos');
      const data = res.data || [];
      if (data.length > 0 && !selectedPeriodoId) {
        setSelectedPeriodoId(data[0].id);
      }
      return data;
    }
  });

  // Set default period once loaded
  React.useEffect(() => {
    if (periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  // 2. Fetch Balance General Report
  const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
    queryKey: ['contabilidad-reporte', selectedPeriodoId, 'BALANCE'],
    queryFn: async () => {
      if (!selectedPeriodoId) return null;
      const res = await api.get(`/contabilidad/reporte?periodoId=${selectedPeriodoId}&tipoReporte=BALANCE`);
      return res.data;
    },
    enabled: !!selectedPeriodoId
  });

  // 3. Fetch Estado de Resultados Report
  const { data: resultadosData, isLoading: isLoadingResultados } = useQuery({
    queryKey: ['contabilidad-reporte', selectedPeriodoId, 'ESTADO_RESULTADOS'],
    queryFn: async () => {
      if (!selectedPeriodoId) return null;
      const res = await api.get(`/contabilidad/reporte?periodoId=${selectedPeriodoId}&tipoReporte=ESTADO_RESULTADOS`);
      return res.data;
    },
    enabled: !!selectedPeriodoId
  });

  const selectedPeriodoObj = periodos.find(p => p.id === selectedPeriodoId);

  // --- Dynamic Calculations for Balance General ---
  const balanceCalculated = useMemo(() => {
    if (!balanceData?.rubros) return null;
    const rubros = balanceData.rubros;

    const getVal = (code) => {
      const r = rubros.find(x => x.codigo === code);
      return r ? Number(r.total_rubro || 0) : 0;
    };

    // Activo corriente
    const actCorrDetalle = [
      { code: 'ACT_CORR_EFECTIVO', name: 'Efectivo y equivalentes de efectivo', val: getVal('ACT_CORR_EFECTIVO') },
      { code: 'ACT_CORR_DEUDORES', name: 'Deudores comerciales y otros', val: getVal('ACT_CORR_DEUDORES') },
      { code: 'ACT_CORR_PAGOS_ANTICIPADOS', name: 'Pagos anticipados', val: getVal('ACT_CORR_PAGOS_ANTICIPADOS') },
      { code: 'ACT_CORR_ANTICIPO_IMPUESTOS', name: 'Anticipo de impuestos', val: getVal('ACT_CORR_ANTICIPO_IMPUESTOS') },
      { code: 'ACT_CORR_COBRAR_TRAB', name: 'Por cobrar a trabajadores', val: getVal('ACT_CORR_COBRAR_TRAB') },
      { code: 'ACT_CORR_COBRAR_PART', name: 'Por cobrar a particulares', val: getVal('ACT_CORR_COBRAR_PART') },
      { code: 'ACT_CORR_INVENTARIOS', name: 'Inventarios', val: getVal('ACT_CORR_INVENTARIOS') },
      { code: 'ACT_CORR_GASTOS_ANTICIPADOS', name: 'Gastos pagados por anticipado', val: getVal('ACT_CORR_GASTOS_ANTICIPADOS') },
    ];
    const totalActivoCorriente = actCorrDetalle.reduce((sum, item) => sum + item.val, 0);

    // Activo no corriente
    const actNoCorrDetalle = [
      { code: 'ACT_NOCORR_PPE', name: 'Propiedades, planta y equipo', val: getVal('ACT_NOCORR_PPE') },
      { code: 'ACT_NOCORR_DEP', name: 'Depreciación', val: getVal('ACT_NOCORR_DEP') },
      { code: 'ACT_NOCORR_IMP_DIFERIDO', name: 'Impuesto de renta diferido', val: getVal('ACT_NOCORR_IMP_DIFERIDO') },
    ];
    const totalActivoNoCorriente = actNoCorrDetalle.reduce((sum, item) => sum + item.val, 0);
    const totalActivos = totalActivoCorriente + totalActivoNoCorriente;

    // Pasivo Corriente
    const pasCorrDetalle = [
      { code: 'PAS_CORR_OBLIG_FIN', name: 'Obligaciones Financieras', val: getVal('PAS_CORR_OBLIG_FIN') },
      { code: 'PAS_CORR_OBLIG_PART', name: 'Obligaciones con particulares', val: getVal('PAS_CORR_OBLIG_PART') },
      { code: 'PAS_CORR_PROVEEDORES', name: 'Proveedores', val: getVal('PAS_CORR_PROVEEDORES') },
      { code: 'PAS_CORR_CXP', name: 'Cuentas por Pagar', val: getVal('PAS_CORR_CXP') },
      { code: 'PAS_CORR_BENEF_EMP', name: 'Beneficio a empleados', val: getVal('PAS_CORR_BENEF_EMP') },
      { code: 'PAS_CORR_PAS_ESTIM', name: 'Pasivos estimados y provisiones', val: getVal('PAS_CORR_PAS_ESTIM') },
      { code: 'PAS_CORR_IMPUESTOS', name: 'Impuestos, Gravámenes y Tasas', val: getVal('PAS_CORR_IMPUESTOS') },
      { code: 'PAS_CORR_OTROS', name: 'Otros pasivos', val: getVal('PAS_CORR_OTROS') },
    ];
    const totalPasivoCorriente = pasCorrDetalle.reduce((sum, item) => sum + item.val, 0);

    // Pasivo No Corriente
    const pasNoCorrDetalle = [
      { code: 'PAS_NOCORR_OBLIG_FIN', name: 'Obligaciones financieras', val: getVal('PAS_NOCORR_OBLIG_FIN') },
      { code: 'PAS_NOCORR_PROV_PENSION', name: 'Provisión Pensión', val: getVal('PAS_NOCORR_PROV_PENSION') },
      { code: 'PAS_NOCORR_DIFERIDOS', name: 'Diferidos', val: getVal('PAS_NOCORR_DIFERIDOS') },
    ];
    const totalPasivoNoCorriente = pasNoCorrDetalle.reduce((sum, item) => sum + item.val, 0);
    const totalPasivo = totalPasivoCorriente + totalPasivoNoCorriente;

    // Patrimonio
    const patrimonioDetalle = [
      { code: 'PAT_CAPITAL', name: 'Capital Social', val: getVal('PAT_CAPITAL') },
      { code: 'PAT_RES_EJERCICIO', name: 'Resultados del Ejercicio', val: getVal('PAT_RES_EJERCICIO') },
      { code: 'PAT_RES_ANTERIORES', name: 'Resultados de Ejercicios Anteriores', val: getVal('PAT_RES_ANTERIORES') },
    ];
    const totalPatrimonio = patrimonioDetalle.reduce((sum, item) => sum + item.val, 0);
    const totalPasivoPatrimonio = totalPasivo + totalPatrimonio;

    const descuadre = Math.abs(totalActivos - totalPasivoPatrimonio);
    const estaCuadrado = descuadre < 0.01;

    return {
      actCorrDetalle,
      totalActivoCorriente,
      actNoCorrDetalle,
      totalActivoNoCorriente,
      totalActivos,
      pasCorrDetalle,
      totalPasivoCorriente,
      pasNoCorrDetalle,
      totalPasivoNoCorriente,
      totalPasivo,
      patrimonioDetalle,
      totalPatrimonio,
      totalPasivoPatrimonio,
      estaCuadrado,
      descuadre,
      cuentasSinClasificar: balanceData.cuentasSinClasificar || [],
      totalSinClasificar: balanceData.totalSinClasificar || 0
    };
  }, [balanceData]);

  // --- Dynamic Calculations for Estado de Resultados ---
  const resultadosCalculated = useMemo(() => {
    if (!resultadosData?.rubros) return null;
    const rubros = resultadosData.rubros;

    const getVal = (code) => {
      const r = rubros.find(x => x.codigo === code);
      return r ? Number(r.total_rubro || 0) : 0;
    };

    // Ingresos Ordinarios
    const ventaServicios = getVal('RES_ING_VENTA');
    const costoServicio = getVal('RES_ING_COSTO');
    const utilidadBruta = ventaServicios - costoServicio;

    // Gastos Administracion
    const gAdminDetalle = [
      { code: 'RES_GADMIN_PERSONAL', name: 'Personal (beneficios a empleados)', val: getVal('RES_GADMIN_PERSONAL') },
      { code: 'RES_GADMIN_HONORARIOS', name: 'Honorarios', val: getVal('RES_GADMIN_HONORARIOS') },
      { code: 'RES_GADMIN_IMPUESTOS', name: 'Impuestos', val: getVal('RES_GADMIN_IMPUESTOS') },
      { code: 'RES_GADMIN_ARRENDAMIENTO', name: 'Arrendamiento', val: getVal('RES_GADMIN_ARRENDAMIENTO') },
      { code: 'RES_GADMIN_SERVICIOS', name: 'Servicios', val: getVal('RES_GADMIN_SERVICIOS') },
      { code: 'RES_GADMIN_LEGALES', name: 'Gastos legales', val: getVal('RES_GADMIN_LEGALES') },
      { code: 'RES_GADMIN_MANTENIMIENTO', name: 'Mantenimiento y reparaciones', val: getVal('RES_GADMIN_MANTENIMIENTO') },
      { code: 'RES_GADMIN_VIAJE', name: 'Gastos de viaje', val: getVal('RES_GADMIN_VIAJE') },
      { code: 'RES_GADMIN_DEP', name: 'Depreciación', val: getVal('RES_GADMIN_DEP') },
      { code: 'RES_GADMIN_DIVERSOS', name: 'Diversos', val: getVal('RES_GADMIN_DIVERSOS') },
    ];
    const totalGAdmin = gAdminDetalle.reduce((sum, item) => sum + item.val, 0);

    // Gastos Ventas
    const gVentasDetalle = [
      { code: 'RES_GVENTAS_PERSONAL', name: 'Personal (beneficios a empleados)', val: getVal('RES_GVENTAS_PERSONAL') },
      { code: 'RES_GVENTAS_HONORARIOS', name: 'Honorarios', val: getVal('RES_GVENTAS_HONORARIOS') },
      { code: 'RES_GVENTAS_IMPUESTOS', name: 'Impuestos', val: getVal('RES_GVENTAS_IMPUESTOS') },
      { code: 'RES_GVENTAS_ARRENDAMIENTO', name: 'Arrendamiento', val: getVal('RES_GVENTAS_ARRENDAMIENTO') },
      { code: 'RES_GVENTAS_SERVICIOS', name: 'Servicios', val: getVal('RES_GVENTAS_SERVICIOS') },
      { code: 'RES_GVENTAS_DIVERSOS', name: 'Diversos', val: getVal('RES_GVENTAS_DIVERSOS') },
      { code: 'RES_GVENTAS_DETERIORO', name: 'Deterioro', val: getVal('RES_GVENTAS_DETERIORO') },
    ];
    const totalGVentas = gVentasDetalle.reduce((sum, item) => sum + item.val, 0);
    const totalGastosOperacionales = totalGAdmin + totalGVentas;
    const utilidadOperacional = utilidadBruta - totalGastosOperacionales;

    // Otros Ingresos
    const otrosIngDetalle = [
      { code: 'RES_INGFIN', name: 'Ingresos financieros', val: getVal('RES_INGFIN') },
      { code: 'RES_OTROS_ARRENDAMIENTO', name: 'Arrendamiento', val: getVal('RES_OTROS_ARRENDAMIENTO') },
      { code: 'RES_OTROS_ING', name: 'Otros ingresos', val: getVal('RES_OTROS_ING') },
    ];
    const totalOtrosIngresos = otrosIngDetalle.reduce((sum, item) => sum + item.val, 0);

    // Otros Gastos
    const otrosGastosDetalle = [
      { code: 'RES_GASTOSFIN', name: 'Gastos financieros', val: getVal('RES_GASTOSFIN') },
      { code: 'RES_OTROS_GASTOS', name: 'Otros gastos', val: getVal('RES_OTROS_GASTOS') },
    ];
    const totalOtrosGastos = otrosGastosDetalle.reduce((sum, item) => sum + item.val, 0);

    const utilidadAntesImpuestos = utilidadOperacional + totalOtrosIngresos - totalOtrosGastos;
    const impuestoGanancias = getVal('RES_IMP_GANANCIAS');
    const resultadoPeriodo = utilidadAntesImpuestos - impuestoGanancias;

    return {
      ventaServicios,
      costoServicio,
      utilidadBruta,
      gAdminDetalle,
      totalGAdmin,
      gVentasDetalle,
      totalGVentas,
      totalGastosOperacionales,
      utilidadOperacional,
      otrosIngDetalle,
      totalOtrosIngresos,
      otrosGastosDetalle,
      totalOtrosGastos,
      utilidadAntesImpuestos,
      impuestoGanancias,
      resultadoPeriodo,
      cuentasSinClasificar: resultadosData.cuentasSinClasificar || [],
      totalSinClasificar: resultadosData.totalSinClasificar || 0
    };
  }, [resultadosData]);

  const mesesNombres = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="app-layout">
      <Topbar 
        title="Contabilidad — Libro Mayor" 
        subtitle="Activos, Pasivos y Estado de Resultados por Período"
        rightContent={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Period Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <select
                className="input"
                style={{ minWidth: '180px' }}
                value={selectedPeriodoId}
                onChange={(e) => setSelectedPeriodoId(e.target.value)}
                disabled={isLoadingPeriodos || periodos.length === 0}
              >
                {periodos.length === 0 ? (
                  <option value="">Sin períodos importados</option>
                ) : (
                  periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {mesesNombres[p.mes]} {p.anio}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Upload Button */}
            <button 
              className="btn btn--primary" 
              onClick={() => setIsImportModalOpen(true)}
            >
              <Upload size={16} /> Importar Libro Mayor
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* Navigation Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: '1.5rem',
          paddingBottom: '0.5rem'
        }}>
          <button
            className={`btn ${activeTab === 'balance' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ borderRadius: '6px', fontSize: '0.875rem' }}
            onClick={() => setActiveTab('balance')}
          >
            <Layers size={16} /> Balance General
          </button>
          <button
            className={`btn ${activeTab === 'resultados' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ borderRadius: '6px', fontSize: '0.875rem' }}
            onClick={() => setActiveTab('resultados')}
          >
            <BarChart2 size={16} /> Estado de Resultados
          </button>
          <button
            className={`btn ${activeTab === 'clasificacion' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ borderRadius: '6px', fontSize: '0.875rem' }}
            onClick={() => setActiveTab('clasificacion')}
          >
            <DollarSign size={16} /> Clasificación de Cuentas PUC
          </button>
        </div>

        {/* Tab 1: Balance General */}
        {activeTab === 'balance' && (
          <div>
            {!selectedPeriodoId ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem' }}>No hay períodos importados aún.</p>
                <button className="btn btn--primary" onClick={() => setIsImportModalOpen(true)}>
                  <Upload size={16} /> Importar primer período
                </button>
              </div>
            ) : isLoadingBalance ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando Balance General...</div>
            ) : balanceCalculated && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                
                {/* Ecuacion Contable Indicator Banner */}
                <div style={{
                  background: balanceCalculated.estaCuadrado ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${balanceCalculated.estaCuadrado ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {balanceCalculated.estaCuadrado ? (
                      <CheckCircle size={24} style={{ color: '#22c55e' }} />
                    ) : (
                      <AlertTriangle size={24} style={{ color: '#ef4444' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {balanceCalculated.estaCuadrado ? 'Balance Cuadrado' : 'Balance Descuadrado'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Total Activos ({formatCurrency(balanceCalculated.totalActivos)}) = Total Pasivo + Patrimonio ({formatCurrency(balanceCalculated.totalPasivoPatrimonio)})
                        {!balanceCalculated.estaCuadrado && ` • Diferencia: ${formatCurrency(balanceCalculated.descuadre)}`}
                      </div>
                    </div>
                  </div>

                  {balanceCalculated.cuentasSinClasificar.length > 0 && (
                    <button 
                      className="btn btn--secondary" 
                      style={{ fontSize: '0.8rem', borderColor: '#eab308', color: '#eab308' }}
                      onClick={() => setActiveTab('clasificacion')}
                    >
                      <AlertTriangle size={14} /> Hay {balanceCalculated.cuentasSinClasificar.length} cuentas sin clasificar
                    </button>
                  )}
                </div>

                {/* Balance General Table Styled Exactly as Insumo 2 */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {/* ACTIVOS HEADER */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          ACTIVOS
                        </td>
                      </tr>

                      {/* Activo corriente */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Activo corriente
                        </td>
                      </tr>
                      {balanceCalculated.actCorrDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total Activo corriente</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceCalculated.totalActivoCorriente)}
                        </td>
                      </tr>

                      {/* Activo no corriente */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Activo no corriente
                        </td>
                      </tr>
                      {balanceCalculated.actNoCorrDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total Activo no corriente</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceCalculated.totalActivoNoCorriente)}
                        </td>
                      </tr>

                      {/* Total Activos */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>
                        <td style={{ padding: '0.75rem 1.25rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Total Activos</td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontSize: '1.05rem', fontFamily: 'monospace', color: '#60a5fa' }}>
                          {formatCurrency(balanceCalculated.totalActivos)}
                        </td>
                      </tr>

                      {/* PASIVOS HEADER */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', paddingTop: '1.5rem' }}>
                          PASIVOS
                        </td>
                      </tr>

                      {/* Corrientes */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Corrientes
                        </td>
                      </tr>
                      {balanceCalculated.pasCorrDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total Pasivo Corriente</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceCalculated.totalPasivoCorriente)}
                        </td>
                      </tr>

                      {/* No Corriente */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          No Corriente
                        </td>
                      </tr>
                      {balanceCalculated.pasNoCorrDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total Pasivo no corriente</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceCalculated.totalPasivoNoCorriente)}
                        </td>
                      </tr>

                      {/* Total Pasivo */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>
                        <td style={{ padding: '0.6rem 1.25rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>Total Pasivo</td>
                        <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right', fontSize: '1rem', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceCalculated.totalPasivo)}
                        </td>
                      </tr>

                      {/* PATRIMONIO HEADER */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', paddingTop: '1.5rem' }}>
                          PATRIMONIO
                        </td>
                      </tr>
                      {balanceCalculated.patrimonioDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total Patrimonio</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceCalculated.totalPatrimonio)}
                        </td>
                      </tr>

                      {/* Total Pasivo y Patrimonio */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>
                        <td style={{ padding: '0.75rem 1.25rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Total Pasivo y Patrimonio</td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontSize: '1.05rem', fontFamily: 'monospace', color: '#60a5fa' }}>
                          {formatCurrency(balanceCalculated.totalPasivoPatrimonio)}
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Tab 2: Estado de Resultados */}
        {activeTab === 'resultados' && (
          <div>
            {!selectedPeriodoId ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>Selecciona o importa un período.</p>
              </div>
            ) : isLoadingResultados ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando Estado de Resultados...</div>
            ) : resultadosCalculated && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                
                {/* Result KPI Card */}
                <div className="card" style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1.25rem 1.5rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Resultado del Período ({mesesNombres[selectedPeriodoObj?.mes]} {selectedPeriodoObj?.anio})
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: resultadosCalculated.resultadoPeriodo >= 0 ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
                      {formatCurrency(resultadosCalculated.resultadoPeriodo)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Utilidad Bruta</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {formatCurrency(resultadosCalculated.utilidadBruta)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Utilidad Operacional</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {formatCurrency(resultadosCalculated.utilidadOperacional)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estado de Resultados Table Styled Exactly as Insumo 2 */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {/* ESTADO DE RESULTADOS HEADER */}
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          ESTADO DE RESULTADOS
                        </td>
                      </tr>

                      {/* Ingresos Ordinarios */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Ingresos Ordinarios
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>Venta de servicios</td>
                        <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.ventaServicios)}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>Costo del servicio</td>
                        <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.costoServicio)}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Utilidad Bruta en Ventas</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.utilidadBruta)}
                        </td>
                      </tr>

                      {/* Gastos ordinarios — Administración */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Gastos ordinarios — Administración
                        </td>
                      </tr>
                      {resultadosCalculated.gAdminDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total gastos de administración</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.totalGAdmin)}
                        </td>
                      </tr>

                      {/* Gastos ordinarios — Ventas */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Gastos ordinarios — Ventas
                        </td>
                      </tr>
                      {resultadosCalculated.gVentasDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total gastos de ventas</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.totalGVentas)}
                        </td>
                      </tr>

                      {/* Total gastos Operacionales & Utilidad Operacional */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>Total gastos Operacionales</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.totalGastosOperacionales)}
                        </td>
                      </tr>
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>
                        <td style={{ padding: '0.6rem 1.25rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>UTILIDAD OPERACIONAL</td>
                        <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right', fontSize: '1rem', fontFamily: 'monospace', color: '#60a5fa' }}>
                          {formatCurrency(resultadosCalculated.utilidadOperacional)}
                        </td>
                      </tr>

                      {/* Otros Ingresos */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)', paddingTop: '1rem' }}>
                          Otros ingresos
                        </td>
                      </tr>
                      {resultadosCalculated.otrosIngDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total otros ingresos</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.totalOtrosIngresos)}
                        </td>
                      </tr>

                      {/* Otros Gastos */}
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="2" style={{ padding: '0.5rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Otros gastos
                        </td>
                      </tr>
                      {resultadosCalculated.otrosGastosDetalle.map((item) => (
                        <tr key={item.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>{item.name}</td>
                          <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {formatCurrency(item.val)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600, background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1.75rem', fontSize: '0.875rem' }}>Total otros gastos</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.totalOtrosGastos)}
                        </td>
                      </tr>

                      {/* Resultados Finales */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                        <td style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>Utilidad y/o pérdida antes de impuestos</td>
                        <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontSize: '0.95rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.utilidadAntesImpuestos)}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.4rem 2.25rem', fontSize: '0.875rem' }}>Impuesto a las ganancias / renta</td>
                        <td style={{ padding: '0.4rem 1.25rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                          {formatCurrency(resultadosCalculated.impuestoGanancias)}
                        </td>
                      </tr>
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>
                        <td style={{ padding: '0.75rem 1.25rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Resultado del periodo</td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontSize: '1.1rem', fontFamily: 'monospace', color: resultadosCalculated.resultadoPeriodo >= 0 ? '#22c55e' : '#ef4444' }}>
                          {formatCurrency(resultadosCalculated.resultadoPeriodo)}
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Tab 3: Clasificacion Cuentas */}
        {activeTab === 'clasificacion' && (
          <ClasificacionCuentasTab />
        )}
      </main>

      {/* Import Modal */}
      <ImportarModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(periodoId) => {
          refetchPeriodos();
          if (periodoId) setSelectedPeriodoId(periodoId);
        }}
      />
    </div>
  );
}
