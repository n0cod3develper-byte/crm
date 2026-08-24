import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  FilePlus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  X,
  FileText,
  Receipt,
  Layers,
  Trash2,
  Edit,
  ChevronRight,
  Save,
  Clock
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency, formatDateLocal } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const OtsPendientesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notas, setNotas] = useState('');
  const [nroFactura, setNroFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(() => new Date().toISOString().split('T')[0]);

  // ─── Sub-apartado (píldoras) ───
  const [subTab, setSubTab] = useState('pendientes'); // 'pendientes' | 'complementarias'

  // ─── Estado del modal de edición de facturas complementarias ───
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFactura, setEditingFactura] = useState(null);
  const [editNumFactura, setEditNumFactura] = useState('');
  const [editFechaFactura, setEditFechaFactura] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  const activeTab = searchParams.get('tab') || 'ots';
  const empresaIdParam = searchParams.get('empresa_id');

  const setTab = (tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
    setSelectedItems([]);
  };

  const isRemisiones = activeTab === 'remisiones';

  const { data: items, isLoading, isFetching } = useQuery({
    queryKey: [isRemisiones ? 'remisionesPendientes' : 'otsPendientes', empresaIdParam, search],
    queryFn: () => {
      if (isRemisiones) {
        return facturacionApi.getRemisionesPendientes({ empresa_id: empresaIdParam, search });
      }
      return facturacionApi.getOtsPendientes({ empresa_id: empresaIdParam, search });
    },
    keepPreviousData: true
  });

  // ─── Query de prefacturas (Facturas complementarias) ───────────
  const { data: prefacturasRes, isLoading: loadingPrefacturas } = useQuery({
    queryKey: ['facturas', 'PREFACTURA'],
    queryFn: () => facturacionApi.getFacturas({ estado: 'PREFACTURA' })
  });

  // Separar prefacturas por tipo: Mantenimiento (ots_list) vs Servicios (remisiones_list)
  const prefacturasMantenimiento = useMemo(() => {
    if (!prefacturasRes?.data) return [];
    return prefacturasRes.data.filter(f => f.ots_list && f.ots_list.trim() !== '');
  }, [prefacturasRes?.data]);

  const prefacturasServicios = useMemo(() => {
    if (!prefacturasRes?.data) return [];
    return prefacturasRes.data.filter(f => f.remisiones_list && f.remisiones_list.trim() !== '');
  }, [prefacturasRes?.data]);

  const currentPrefacturas = isRemisiones ? prefacturasServicios : prefacturasMantenimiento;

  const toggleSelect = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(o => o.id === item.id);
      if (exists) {
        return prev.filter(o => o.id !== item.id);
      }

      if (prev.length > 0 && prev[0].empresa_id !== item.empresa_id) {
        toast.error('Solo puedes facturar ítems de la misma empresa');
        return prev;
      }
      return [...prev, item];
    });
  };

  const updateItemTotal = (id, newTotalStr) => {
    const newTotal = parseFloat(newTotalStr) || 0;

    setSelectedItems(prev => prev.map(item => {
      if (item.id === id) {
        const originalSaldo = items?.data?.find(d => d.id === id)?.total || item.total;
        const finalTotal = newTotal > originalSaldo ? originalSaldo : newTotal;

        const subtotalCalc = finalTotal / 1.19;
        const ivaCalc = finalTotal - subtotalCalc;

        return { ...item, total: finalTotal, subtotal: subtotalCalc, iva_valor: ivaCalc, original_saldo_pendiente: originalSaldo };
      }
      return item;
    }));
  };

  const selectAll = () => {
    if (!items?.data || items.data.length === 0) return;
    if (selectedItems.length === items.data.length) {
      setSelectedItems([]);
      return;
    }
    const firstEmpresa = items.data[0].empresa_id;
    const sameEmpresa = items.data.filter(i => i.empresa_id === firstEmpresa);
    setSelectedItems(sameEmpresa);
  };

  const totals = useMemo(() => {
    return selectedItems.reduce((acc, item) => ({
      subtotal: acc.subtotal + parseFloat(item.subtotal),
      iva: acc.iva + parseFloat(item.iva_valor),
      total: acc.total + parseFloat(item.total)
    }), { subtotal: 0, iva: 0, total: 0 });
  }, [selectedItems]);

  const createPrefacturaMutation = useMutation({
    mutationFn: (data) => {
      if (isRemisiones) {
        return facturacionApi.createPrefacturaFromRemisiones(data);
      }
      return facturacionApi.createPrefactura(data);
    },
    onSuccess: (res) => {
      toast.success(res.data.estado === 'FACTURADA' ? 'Factura generada correctamente' : 'Prefactura creada correctamente');
      queryClient.invalidateQueries(['otsPendientes']);
      queryClient.invalidateQueries(['remisionesPendientes']);
      setIsModalOpen(false);
      setNroFactura('');
      setNotas('');
      setSelectedItems([]);
      navigate(`/facturacion/facturas/${res.data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al crear la prefactura');
    }
  });

  const confirmPrefacturaMutation = useMutation({
    mutationFn: (data) => facturacionApi.confirmarFactura(selectedItems[0]?.id, data),
    onSuccess: (res) => {
      toast.success('Factura confirmada correctamente');
      queryClient.invalidateQueries(['facturas', 'PREFACTURA']);
      setIsModalOpen(false);
      setNroFactura('');
      setNotas('');
      setSelectedItems([]);
      navigate(`/facturacion/facturas/${res.data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al confirmar la factura');
    }
  });

  const handleCreate = () => {
    if (selectedItems.length === 0) return;
    setNroFactura('');
    setNotas('');
    setFechaFactura(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const confirmCreate = () => {
    if (!nroFactura.trim()) {
      toast.error('El número de factura es obligatorio');
      return;
    }

    const baseData = {
      empresa_id: selectedItems[0].empresa_id,
      condicion_pago: selectedItems[0].condicion_pago || '30_DIAS',
      notas: notas,
      numero_factura: nroFactura,
      fecha_factura: fechaFactura
    };

    if (isRemisiones) {
      createPrefacturaMutation.mutate({
        ...baseData,
        remisiones: selectedItems.map(o => ({
          id: o.id,
          subtotal: o.subtotal,
          iva_valor: o.iva_valor,
          total: o.total
        })),
      });
    } else {
      createPrefacturaMutation.mutate({
        ...baseData,
        ots: selectedItems.map(o => ({
          id: o.id,
          subtotal: o.subtotal,
          iva_valor: o.iva_valor,
          total: o.total
        })),
      });
    }
  };

  // ─── Edición de facturas complementarias ───────────────────────
  const openEditModal = (factura) => {
    setEditingFactura(factura);
    setEditNumFactura(factura.numero_factura || '');
    setEditFechaFactura(factura.fecha_factura ? factura.fecha_factura.split('T')[0] : '');
    setEditMonto(parseFloat(factura.total) || '');
    setEditDescripcion(factura.notas || '');
    setIsEditModalOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => facturacionApi.updateFacturaFields(id, data),
    onSuccess: () => {
      toast.success('Factura complementaria actualizada correctamente');
      queryClient.invalidateQueries(['facturas', 'PREFACTURA']);
      setIsEditModalOpen(false);
      setEditingFactura(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al actualizar la factura');
    }
  });

  const handleSaveEdit = () => {
    const montoNum = parseFloat(editMonto);
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error('El monto debe ser un número válido');
      return;
    }
    if (editFechaFactura && isNaN(new Date(editFechaFactura).getTime())) {
      toast.error('La fecha ingresada no es válida');
      return;
    }

    editMutation.mutate({
      id: editingFactura.id,
      data: {
        numero_factura: editNumFactura,
        fecha_factura: editFechaFactura || null,
        total: montoNum,
        notas: editDescripcion
      }
    });
  };

  return (
    <Layout title={
      activeTab === 'ots' ? 'Órdenes de Trabajo por Facturar' :
        activeTab === 'remisiones' ? 'Remisiones por Facturar' :
          'Facturas Complementarias'
    }>
      <div className="space-y-6 animate-in fade-in duration-500">

        {/* ─── Tab Selector + Search ─────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-1 p-1 bg-subtle/50 rounded-2xl border border-color w-fit" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'ots'}
              onClick={() => setTab('ots')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${activeTab === 'ots'
                  ? 'btn-primary shadow-lg shadow-accent/20'
                  : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
                }`}
              style={{ borderRadius: '0.75rem' }}
            >
              <Layers size={16} />
              Mantenimiento
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'remisiones'}
              onClick={() => setTab('remisiones')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${activeTab === 'remisiones'
                  ? 'btn-primary shadow-lg shadow-accent/20'
                  : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
                }`}
              style={{ borderRadius: '0.75rem' }}
            >
              <Receipt size={16} />
              Servicios
            </button>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar por OT, remisión o empresa..."
              className="input-premium pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ─── Sub Tabs (Píldoras) ─────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-subtle/50 rounded-2xl border border-color w-fit" role="tablist">
          <button
            role="tab"
            aria-selected={subTab === 'pendientes'}
            onClick={() => setSubTab('pendientes')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${subTab === 'pendientes'
                ? 'btn-primary shadow-lg shadow-accent/20'
                : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
              }`}
            style={{ borderRadius: '0.75rem' }}
          >
            <Clock size={16} />
            {isRemisiones ? 'Remisiones por facturar' : 'Órdenes por facturar'}
          </button>
          <button
            role="tab"
            aria-selected={subTab === 'complementarias'}
            onClick={() => setSubTab('complementarias')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${subTab === 'complementarias'
                ? 'btn-primary shadow-lg shadow-accent/20'
                : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
              }`}
            style={{ borderRadius: '0.75rem' }}
          >
            <FileText size={16} />
            Facturas complementarias
          </button>
        </div>

        {/* ─── Resumen Prefactura (Arriba de la tabla para Mantenimiento/Servicios) ──────────────── */}
        {subTab === 'pendientes' && selectedItems.length > 0 ? (
          <div
            className="card-premium border-l-4 border-l-accent animate-in slide-in-from-top-2 duration-300"
            style={{ padding: '1.5rem 2.5rem' }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
              {/* Info izquierda */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <FilePlus size={20} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted tracking-wider">Prefactura</p>
                    <p className="font-bold text-sm">
                      {selectedItems.length} {isRemisiones ? 'Remisiones' : 'OTs'} seleccionadas
                    </p>
                  </div>
                </div>

                <div className="hidden md:block h-8 w-px bg-color" />

                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-muted" />
                  <span className="font-bold text-sm">{selectedItems[0]?.empresa_nombre}</span>
                </div>
              </div>

              {/* Totales y acciones */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted font-bold">Subtotal</p>
                    <p className="font-semibold">{formatCurrency(totals.subtotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted font-bold">IVA</p>
                    <p className="font-semibold">{formatCurrency(totals.iva)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-accent font-bold">Total</p>
                    <p className="font-bold text-lg text-accent">{formatCurrency(totals.total)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn-ghost p-2 rounded-xl text-muted hover:text-red-500 transition-colors"
                    onClick={() => setSelectedItems([])}
                    title="Limpiar selección"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-accent/20 font-bold"
                    onClick={handleCreate}
                  >
                    <CheckCircle2 size={18} />
                    Generar Factura
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : subTab === 'pendientes' ? (
          <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
            <AlertTriangle size={16} className="text-blue-500 shrink-0" />
            <p className="text-sm text-blue-400">
              {isRemisiones
                ? 'Selecciona una o varias remisiones de la misma empresa para generar una factura.'
                : 'Selecciona una o varias órdenes de trabajo de la misma empresa para generar una factura.'
              }
            </p>
          </div>
        ) : null}

        {/* ─── Tabla Principal (Mantenimiento o Servicios) ──────────────────────────────────────── */}
        {subTab === 'pendientes' && (
          <div className="card-premium overflow-hidden" style={{ position: 'relative' }}>
            {/* Loading overlay sobre la tabla */}
            {(isLoading || isFetching) && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, borderRadius: 'inherit' }}>
                <div className="spinner h-8 w-8" />
              </div>
            )}
            <table className="w-full">
              <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4 text-center w-12">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer mx-auto ${items?.data?.length > 0 && selectedItems.length === items.data.length
                          ? 'bg-accent border-accent text-white'
                          : 'border-color hover:border-accent/50'
                        }`}
                      onClick={selectAll}
                    />
                  </th>
                  <th className="px-5 py-4 text-left">{isRemisiones ? 'Remisión' : 'Orden'}</th>
                  <th className="px-5 py-4 text-left">Empresa</th>
                  <th className="px-5 py-4 text-left">Liquidada</th>
                  <th className="px-5 py-4 text-right">Saldo Pendiente</th>
                  <th className="px-5 py-4 text-right w-48">Monto a Facturar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-color">
                {items?.data?.map((item) => {
                  const isSelected = selectedItems.find(o => o.id === item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`transition-all cursor-pointer ${isSelected
                          ? 'bg-accent/5 hover:bg-accent/10'
                          : 'hover:bg-subtle/30'
                        }`}
                      onClick={() => toggleSelect(item)}
                    >
                      <td className="px-5 py-4 text-center">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${isSelected ? 'bg-accent border-accent text-white' : 'border-color'
                          }`}>
                          {isSelected && <CheckCircle2 size={12} />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold">{item.consecutivo}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-muted" />
                          <span className="font-semibold">{item.empresa_nombre}</span>
                        </div>
                        <div className="text-[10px] text-muted uppercase tracking-tighter">NIT: {item.empresa_nit}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-muted" />
                          <span>{new Date(item.fecha_liquidacion).toLocaleDateString()}</span>
                        </div>
                        <div className={`text-[10px] font-bold ${item.dias_desde_liquidacion > 30 ? 'text-red-500' : 'text-muted'}`}>
                          Hace {item.dias_desde_liquidacion} días
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-muted">{formatCurrency(item.original_saldo_pendiente || item.total)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isSelected ? (
                          <div className="flex items-center justify-end">
                            <span className="text-muted mr-1">$</span>
                            <input
                              type="number"
                              className="input-premium text-right w-32 py-1 px-2 text-accent font-bold"
                              value={isSelected.total}
                              onChange={(e) => updateItemTotal(item.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <span className="text-muted italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(!items?.data || items.data.length === 0) && !isLoading && (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center text-muted italic">
                      {isRemisiones
                        ? 'No se encontraron remisiones liquidadas pendientes de facturar.'
                        : 'No se encontraron órdenes de trabajo liquidadas pendientes de facturar.'
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Facturas Complementarias ──────────────────────────────── */}
        {subTab === 'complementarias' && (
          <div className="card-premium overflow-hidden" style={{ position: 'relative' }}>
            {loadingPrefacturas && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, borderRadius: 'inherit' }}>
                <div className="spinner h-8 w-8" />
              </div>
            )}

            <table className="w-full">
              <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4 text-center w-12">Sel</th>
                  <th className="px-5 py-4 text-left">Nro Factura</th>
                  <th className="px-5 py-4 text-left">Empresa</th>
                  <th className="px-5 py-4 text-left">Nro Remisión</th>
                  <th className="px-5 py-4 text-left">Fecha</th>
                  <th className="px-5 py-4 text-right">Monto</th>
                  <th className="px-5 py-4 text-left">Descripción</th>
                  <th className="px-5 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-color">
                {currentPrefacturas.map((factura) => {
                  const isSelected = selectedItems.find(o => o.id === factura.id);
                  return (
                    <tr
                      key={factura.id}
                      className={`transition-all cursor-pointer ${isSelected
                          ? 'bg-accent/5 hover:bg-accent/10 ring-1 ring-inset ring-accent/20'
                          : 'hover:bg-subtle/30'
                        }`}
                      onClick={() => toggleSelect({ ...factura, isPrefactura: true })}
                    >
                      <td className="px-5 py-4 text-center">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mx-auto transition-all ${isSelected ? 'bg-accent border-accent text-white' : 'border-color'
                          }`}>
                          {isSelected && <CheckCircle2 size={12} />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                            <Receipt size={14} className="text-orange-500" />
                          </div>
                          <span className="font-bold text-sm" title={factura.numero_factura || factura.consecutivo_interno}>
                            {factura.numero_factura ? (
                              <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-500 font-bold text-xs uppercase">
                                {factura.numero_factura}
                              </span>
                            ) : (
                              <span className="text-muted text-xs">{factura.consecutivo_interno}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-muted" />
                          <span className="font-semibold text-sm">{factura.empresa_nombre}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-sm text-muted">
                          {isRemisiones ? factura.remisiones_list : factura.ots_list}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-muted text-sm">
                          <Calendar size={14} />
                          <span>{formatDateLocal(factura.fecha_factura)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-accent">
                        {formatCurrency(factura.total)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-muted max-w-[200px] truncate block" title={factura.notas || ''}>
                          {factura.notas || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-1">
                          <button
                            className="p-2 rounded-lg hover:bg-subtle text-muted hover:text-accent transition-all"
                            onClick={(e) => { e.stopPropagation(); navigate(`/facturacion/facturas/${factura.id}`); }}
                            title="Ver detalle"
                          >
                            <ChevronRight size={18} />
                          </button>
                          <button
                            className="p-2 rounded-lg hover:bg-subtle text-muted hover:text-accent transition-all"
                            onClick={(e) => { e.stopPropagation(); openEditModal(factura); }}
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {currentPrefacturas.length === 0 && !loadingPrefacturas && (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-muted italic">
                      No hay facturas complementarias de {isRemisiones ? 'servicios' : 'mantenimiento'} pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ─── Barra Flotante Inferior (solo Prefacturas) ─────────────────── */}
      {selectedItems.length > 0 && selectedItems[0]?.isPrefactura && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300 w-full px-4" style={{ maxWidth: '1200px' }}>
          <div className="card-premium flex items-center justify-between px-8 py-6 shadow-2xl shadow-black/50 border border-accent/30 bg-background/95 backdrop-blur-xl" style={{ borderRadius: '1.25rem' }}>
            <div className="flex items-center gap-6 pl-2">
              <div className="flex items-center gap-3 border-r border-color pr-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted tracking-wider">Prefactura</p>
                  <p className="font-bold text-sm">1 Seleccionada</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Building2 size={16} />
                <span className="font-bold text-foreground">{selectedItems[0]?.empresa_nombre}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold tracking-widest">Subtotal</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(selectedItems[0]?.subtotal) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold tracking-widest">IVA</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(selectedItems[0]?.iva_valor) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-accent font-bold tracking-widest">Total</p>
                  <p className="font-bold text-lg text-accent">{formatCurrency(parseFloat(selectedItems[0]?.total) || 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-color pl-6">
                <button
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                  onClick={() => setSelectedItems([])}
                  title="Cancelar Selección"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  className="btn-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-accent/20"
                  onClick={() => {
                    const factura = selectedItems[0];
                    setNroFactura(factura.numero_factura || '');
                    setFechaFactura(factura.fecha_factura ? factura.fecha_factura.split('T')[0] : new Date().toISOString().split('T')[0]);
                    setNotas(factura.notas || '');
                    setIsModalOpen(true);
                  }}
                >
                  <CheckCircle2 size={18} /> Confirmar Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Overlay: Generar Factura (Portal a body) ─────────── */}
      {isModalOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            className="card-premium"
            style={{
              width: '100%',
              maxWidth: '700px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              animation: 'modalIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.03))' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <FileText size={24} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    {selectedItems[0]?.isPrefactura ? 'Confirmar Facturación' : 'Generar Factura'}
                  </h3>
                  <p className="text-sm text-muted font-medium">
                    {selectedItems[0]?.isPrefactura
                      ? 'Asignar número definitivo a la prefactura'
                      : `${selectedItems.length} ${isRemisiones ? 'remisiones' : 'OTs'} seleccionadas`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-10" style={{ padding: '2.5rem 3rem' }}>
              {/* Resumen */}
              <div className="bg-subtle/40 p-5 rounded-2xl border border-color flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase font-bold text-muted tracking-widest mb-1">Empresa</p>
                  <p className="font-bold text-lg text-foreground">{selectedItems[0]?.empresa_nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase font-bold text-muted tracking-widest mb-1">
                    {selectedItems[0]?.isPrefactura ? 'Monto a Confirmar' : 'Total a Facturar'}
                  </p>
                  <p className="font-black text-2xl text-accent">
                    {formatCurrency(selectedItems[0]?.isPrefactura ? parseFloat(selectedItems[0]?.total) : totals.total)}
                  </p>
                </div>
              </div>

              {/* Campos del formulario */}
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Número de Factura <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-premium w-full font-bold text-accent text-xl py-4 px-5"
                    placeholder="Ej: FE-1234"
                    value={nroFactura}
                    onChange={(e) => setNroFactura(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-2 font-medium">Ingresa el número de factura electrónica asignado externamente.</p>
                </div>

                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Fecha de Factura <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="input-premium w-full font-bold text-base py-3 px-5"
                    value={fechaFactura}
                    onChange={(e) => setFechaFactura(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Descripción
                  </label>
                  <textarea
                    className="input-premium w-full h-36 resize-none text-base py-4 px-5"
                    placeholder="Ej: Servicios correspondientes al mes de Abril..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.02))' }}>
              <button
                className="btn-secondary flex-1 py-4 rounded-2xl font-bold text-base hover:bg-subtle transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-primary flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => {
                  if (selectedItems[0]?.isPrefactura) {
                    // LLamar a confirmarFactura (esto lo podemos hacer con otra mutación)
                    confirmPrefacturaMutation.mutate({
                      numero_factura: nroFactura,
                      fecha_factura: fechaFactura,
                      sistema_contable: 'SIIGO',
                      notas: notas
                    });
                  } else {
                    confirmCreate();
                  }
                }}
                disabled={createPrefacturaMutation.isLoading || confirmPrefacturaMutation.isLoading || !nroFactura.trim()}
              >
                {createPrefacturaMutation.isLoading || confirmPrefacturaMutation.isLoading ? (
                  <>
                    <div className="spinner h-5 w-5 border-2" />
                    {selectedItems[0]?.isPrefactura ? 'Procesando...' : 'Generando Factura...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    {selectedItems[0]?.isPrefactura ? 'Confirmar y Finalizar' : 'Confirmar Factura'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal: Editar Factura Complementaria (Portal a body) ──── */}
      {isEditModalOpen && editingFactura && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !editMutation.isLoading) setIsEditModalOpen(false); }}
        >
          <div
            className="card-premium"
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              animation: 'modalIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.03))' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Edit size={24} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Editar Factura</h3>
                  <p className="text-sm text-muted font-medium">{editingFactura.consecutivo_interno} — {editingFactura.empresa_nombre}</p>
                </div>
              </div>
              <button
                onClick={() => { if (!editMutation.isLoading) setIsEditModalOpen(false); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-6" style={{ padding: '2.5rem 3rem' }}>
              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Número de Factura
                </label>
                <input
                  type="text"
                  className="input-premium w-full font-bold text-accent text-lg py-4 px-5"
                  placeholder="Ej: FV-2026-00123"
                  value={editNumFactura}
                  onChange={(e) => setEditNumFactura(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Fecha
                </label>
                <input
                  type="date"
                  className="input-premium w-full font-bold text-base py-4 px-5"
                  value={editFechaFactura}
                  onChange={(e) => setEditFechaFactura(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Monto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted font-bold text-lg">$</span>
                  <input
                    type="number"
                    className="input-premium w-full font-bold text-accent text-lg py-4 pl-10 pr-5"
                    placeholder="0"
                    value={editMonto}
                    onChange={(e) => setEditMonto(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Descripción
                </label>
                <textarea
                  className="input-premium w-full py-4 px-5 text-sm resize-none"
                  rows="3"
                  placeholder="Notas opcionales sobre la factura..."
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.02))' }}>
              <button
                className="btn-secondary flex-1 py-4 rounded-2xl font-bold text-base hover:bg-subtle transition-colors"
                onClick={() => { if (!editMutation.isLoading) setIsEditModalOpen(false); }}
                disabled={editMutation.isLoading}
              >
                Cancelar
              </button>
              <button
                className="btn-primary flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={handleSaveEdit}
                disabled={editMutation.isLoading}
              >
                {editMutation.isLoading ? (
                  <>
                    <div className="spinner h-5 w-5 border-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={20} strokeWidth={2.5} />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
};
