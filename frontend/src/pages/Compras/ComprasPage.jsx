import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { 
  PlusCircle, 
  History, 
  Search, 
  Package, 
  ShoppingCart, 
  Calendar, 
  Building2, 
  Hash, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Info,
  Trash2,
  Plus,
  Receipt,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { comprasApi } from '../../services/comprasApi';
import { formatCurrency } from '../../utils/formatters';

export function ComprasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Tab activo: 'registro' o 'historial'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'registro');

  // Cabecera de la Factura
  const today = new Date().toISOString().split('T')[0];
  const [headerForm, setHeaderForm] = useState({
    numero_factura: '',
    fecha_compra: today,
    proveedor_id: '',
    observaciones: ''
  });

  // Lista de Ítems agregados a la factura actual
  const [items, setItems] = useState([]);

  // Formulario para agregar un ítem individual
  const [itemForm, setItemForm] = useState({
    cantidad: '',
    precio_unitario: '',
    iva_pct: 19,
    observaciones_item: ''
  });

  // Estado del buscador de productos para el ítem actual
  const [productSearch, setProductSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const searchDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Modal para ver historial de precios de un producto
  const [modalHistorialProd, setModalHistorialProd] = useState(null);

  // Filtros del historial
  const [histPage, setHistPage] = useState(1);
  const [histSearch, setHistSearch] = useState('');
  const [histProveedor, setHistProveedor] = useState('');
  const [histFechaDesde, setHistFechaDesde] = useState('');
  const [histFechaHasta, setHistFechaHasta] = useState('');

  // Debounce para búsqueda de productos
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Cargar lista de proveedores
  const { data: proveedores = [], isLoading: loadingProvs } = useQuery({
    queryKey: ['proveedores-list'],
    queryFn: comprasApi.getProveedores,
    staleTime: 1000 * 60 * 5
  });

  // Búsqueda de productos en vivo
  const { data: searchResults = [], isFetching: fetchingProducts } = useQuery({
    queryKey: ['compras-buscar-productos', debouncedSearch],
    queryFn: () => comprasApi.buscarProductos(debouncedSearch),
    enabled: debouncedSearch.trim().length >= 2 && !selectedProduct,
    staleTime: 1000 * 30
  });

  // Si viene con query param ?productoId=... (ej. desde Catálogo "Reponer")
  useEffect(() => {
    const prodIdParam = searchParams.get('productoId') || searchParams.get('item');
    if (prodIdParam && !selectedProduct) {
      cargarProductoPorId(prodIdParam);
    }
  }, [searchParams]);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setIsSearchingProduct(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Función para cargar info completa de un producto
  const cargarProductoPorId = async (productoId) => {
    try {
      const info = await comprasApi.getProductoInfo(productoId);
      if (info) {
        setSelectedProduct(info);
        setItemForm(prev => ({
          ...prev,
          // Si tiene último precio y el campo precio unitario está vacío, sugerirlo
          precio_unitario: prev.precio_unitario || (info.ultimo_precio ? String(info.ultimo_precio) : '')
        }));
        setProductSearch(info.nombre);
        setIsSearchingProduct(false);
      }
    } catch (err) {
      toast.error('Error al cargar la información del producto');
    }
  };

  const handleSelectProduct = (prod) => {
    cargarProductoPorId(prod.id);
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setProductSearch('');
    setItemForm({
      cantidad: '',
      precio_unitario: '',
      iva_pct: 19,
      observaciones_item: ''
    });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Agregar el producto configurado a la lista de ítems de la factura
  const handleAddItem = (e) => {
    if (e) e.preventDefault();

    if (!selectedProduct) {
      toast.error('Busca y selecciona un producto antes de agregarlo');
      return;
    }

    const cantidadNum = parseFloat(itemForm.cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error('Ingresa una cantidad válida mayor a cero');
      return;
    }

    const precioNum = parseFloat(itemForm.precio_unitario);
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error('Ingresa un precio unitario válido mayor o igual a cero');
      return;
    }

    const ivaPctNum = parseFloat(itemForm.iva_pct) || 0;
    const subtotalItem = cantidadNum * precioNum;
    const ivaValorItem = subtotalItem * (ivaPctNum / 100);
    const totalItem = subtotalItem + ivaValorItem;

    const nuevoItem = {
      temp_id: Date.now() + Math.random().toString(),
      producto_id: selectedProduct.id,
      codigo_interno: selectedProduct.codigo_interno,
      nombre: selectedProduct.nombre,
      categoria_nombre: selectedProduct.categoria_nombre,
      unidad_medida: selectedProduct.unidad_medida || 'UND',
      cantidad: cantidadNum,
      precio_unitario: precioNum,
      iva_pct: ivaPctNum,
      subtotal: subtotalItem,
      iva_valor: ivaValorItem,
      total: totalItem,
      observaciones_item: itemForm.observaciones_item || ''
    };

    setItems(prev => [...prev, nuevoItem]);
    toast.success(`Ítem "${selectedProduct.nombre}" agregado a la factura`, { icon: '➕' });

    // Limpiar selector para el siguiente ítem
    handleClearProduct();
  };

  // Eliminar un ítem de la lista
  const handleRemoveItem = (tempId) => {
    setItems(prev => prev.filter(it => it.temp_id !== tempId));
  };

  // Cálculos totales globales de la factura
  const totalesFactura = items.reduce((acc, it) => {
    acc.subtotal += it.subtotal;
    acc.iva_total += it.iva_valor;
    acc.gran_total += it.total;
    acc.total_unidades += it.cantidad;
    return acc;
  }, { subtotal: 0, iva_total: 0, gran_total: 0, total_unidades: 0 });

  // Mutación para Registrar Factura Completa Multi-Ítem
  const mutationRegistrar = useMutation({
    mutationFn: (payload) => comprasApi.registrarCompra(payload),
    onSuccess: (data) => {
      const facturaNum = headerForm.numero_factura;
      const count = items.length;
      toast.success(
        `¡Factura ${facturaNum} registrada con éxito! ${count} ${count === 1 ? 'producto ingresado' : 'productos ingresados'} a bodega.`,
        { duration: 5500, icon: '📦' }
      );

      // Invalida inventario, catálogo e historial
      queryClient.invalidateQueries(['inventory']);
      queryClient.invalidateQueries(['catalog-items']);
      queryClient.invalidateQueries(['compras-historial']);

      // Limpiar formulario completo de ítems
      setItems([]);
      setHeaderForm({
        numero_factura: '',
        fecha_compra: today,
        proveedor_id: '',
        observaciones: ''
      });
      handleClearProduct();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || 'Error al registrar la factura de compra';
      toast.error(msg);
    }
  });

  const handleSubmitFacturaCompleta = (e) => {
    if (e) e.preventDefault();

    if (!headerForm.numero_factura.trim()) {
      toast.error('Ingresa el número de factura');
      return;
    }
    if (!headerForm.proveedor_id) {
      toast.error('Selecciona el proveedor');
      return;
    }
    if (!headerForm.fecha_compra) {
      toast.error('Selecciona la fecha de compra');
      return;
    }
    if (items.length === 0) {
      toast.error('Debes agregar al menos un ítem a la lista antes de guardar la factura');
      return;
    }

    mutationRegistrar.mutate({
      numero_factura: headerForm.numero_factura,
      fecha_compra: headerForm.fecha_compra,
      proveedor_id: headerForm.proveedor_id,
      observaciones: headerForm.observaciones,
      items: items.map(it => ({
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        iva_pct: it.iva_pct,
        observaciones: it.observaciones_item
      }))
    });
  };

  // Consulta del Historial de Compras
  const { data: historialData, isLoading: loadingHistorial, refetch: refetchHistorial } = useQuery({
    queryKey: ['compras-historial', histPage, histSearch, histProveedor, histFechaDesde, histFechaHasta],
    queryFn: () => comprasApi.getHistorial({
      page: histPage,
      limit: 15,
      search: histSearch,
      proveedor_id: histProveedor || undefined,
      fecha_desde: histFechaDesde || undefined,
      fecha_hasta: histFechaHasta || undefined
    }),
    enabled: activeTab === 'historial',
    keepPreviousData: true
  });

  // Consulta de Precios de un Producto para Modal
  const { data: preciosProducto = [], isLoading: loadingPreciosProd } = useQuery({
    queryKey: ['compras-precios-producto', modalHistorialProd?.id],
    queryFn: () => comprasApi.getHistorialPrecios(modalHistorialProd?.id),
    enabled: !!modalHistorialProd?.id
  });

  return (
    <div className="app-layout">
      <Topbar 
        title="Registro de Compras"
        subtitle="Ingreso directo de compras al inventario físico e historial de precios"
      />

      <main className="main-content">
        <div className="animate-in fade-in duration-300">

          {/* Selector de Pestañas */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => { setActiveTab('registro'); setSearchParams({ tab: 'registro' }); }}
              className={`btn ${activeTab === 'registro' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <PlusCircle size={18} /> Registrar Compra
            </button>
            <button
              onClick={() => { setActiveTab('historial'); setSearchParams({ tab: 'historial' }); }}
              className={`btn ${activeTab === 'historial' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <History size={18} /> Historial de Compras
            </button>
          </div>

          {/* ======================================================== */}
          {/* PESTAÑA 1: FORMULARIO DE FACTURA MULTI-ÍTEM             */}
          {/* ======================================================== */}
          {activeTab === 'registro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px' }}>
              
              {/* 1. CABECERA DE LA FACTURA */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--clr-primary-500)' }}>
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      1. Datos Generales de la Factura
                    </h2>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      Identificación del comprobante y proveedor comercial.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  
                  {/* N° Factura */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      N° Factura <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej: FE-98421"
                        value={headerForm.numero_factura}
                        onChange={(e) => setHeaderForm({ ...headerForm, numero_factura: e.target.value })}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.25rem' }}
                      />
                      <Hash size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Fecha de Compra */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Fecha de Compra <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="date" 
                        required
                        value={headerForm.fecha_compra}
                        onChange={(e) => setHeaderForm({ ...headerForm, fecha_compra: e.target.value })}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.25rem' }}
                      />
                      <Calendar size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Proveedor */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Proveedor <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        required
                        value={headerForm.proveedor_id}
                        onChange={(e) => setHeaderForm({ ...headerForm, proveedor_id: e.target.value })}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.25rem' }}
                      >
                        <option value="">-- Seleccionar Proveedor --</option>
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.razon_social} {p.nombre_comercial ? `(${p.nombre_comercial})` : ''} - NIT: {p.numero_documento}
                          </option>
                        ))}
                      </select>
                      <Building2 size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Observaciones Generales */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Observaciones de Factura (Opcional)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej: Entrega parcial, compra para taller central..."
                      value={headerForm.observaciones}
                      onChange={(e) => setHeaderForm({ ...headerForm, observaciones: e.target.value })}
                      className="form-control"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. AGREGAR ÍTEM A LA FACTURA */}
              <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                      <PlusCircle size={20} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        2. Agregar Ítems a la Factura
                      </h2>
                      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        Busca el producto, define la cantidad y precio, y agrégalo a la lista.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Buscador de Producto con Debounce y Resultados en Vivo */}
                <div style={{ marginBottom: '1.25rem', position: 'relative' }} ref={searchDropdownRef}>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Producto / Repuesto a Agregar <span style={{ color: 'var(--clr-danger)' }}>*</span>
                  </label>

                  {!selectedProduct ? (
                    <div style={{ position: 'relative' }}>
                      <input 
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar por nombre, código interno, referencia o SKU..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setIsSearchingProduct(true);
                        }}
                        onFocus={() => setIsSearchingProduct(true)}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                      />
                      <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                      
                      {fetchingProducts && (
                        <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          Buscando...
                        </div>
                      )}

                      {/* Dropdown de resultados */}
                      {isSearchingProduct && debouncedSearch.trim().length >= 2 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-lg)',
                          zIndex: 50,
                          maxHeight: '260px',
                          overflowY: 'auto',
                          marginTop: '4px'
                        }}>
                          {searchResults.length > 0 ? (
                            searchResults.map(prod => (
                              <div
                                key={prod.id}
                                onClick={() => handleSelectProduct(prod)}
                                style={{
                                  padding: '0.75rem 1rem',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--border-color)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-app)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', background: 'var(--bg-app)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                      {prod.codigo_interno}
                                    </span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                                      {prod.nombre}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                    {prod.categoria_nombre && `Categoría: ${prod.categoria_nombre} | `}
                                    {prod.marca && `Marca: ${prod.marca} | `}
                                    {prod.referencia_fabricante && `Ref: ${prod.referencia_fabricante}`}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: prod.stock_actual > 0 ? 'var(--clr-primary-500)' : 'var(--clr-danger)' }}>
                                    Stock: {prod.stock_actual} {prod.unidad_medida}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                              No se encontraron productos coincidentes con "{debouncedSearch}".
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Tarjeta de Producto Seleccionado con Stock Actual y Último Precio */
                    <div style={{
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1.15rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={20} color="var(--clr-primary-500)" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', background: 'var(--bg-surface)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                              {selectedProduct.codigo_interno}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {selectedProduct.nombre}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {selectedProduct.categoria_nombre && `${selectedProduct.categoria_nombre} • `}
                            Unidad: <strong>{selectedProduct.unidad_medida}</strong>
                            {selectedProduct.marca && ` • Marca: ${selectedProduct.marca}`}
                          </div>
                        </div>
                      </div>

                      {/* Badges de Stock y Último Precio */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stock Actual</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: selectedProduct.stock_actual > 0 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                            {selectedProduct.stock_actual} {selectedProduct.unidad_medida}
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Último Precio</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: selectedProduct.ultimo_precio ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {selectedProduct.ultimo_precio ? formatCurrency(selectedProduct.ultimo_precio) : 'Sin registro'}
                          </div>
                        </div>

                        {selectedProduct.ultimo_precio && (
                          <button
                            type="button"
                            onClick={() => setModalHistorialProd(selectedProduct)}
                            className="btn btn--secondary btn--sm"
                            title="Ver evolución histórica de precios de compra"
                            style={{ height: '32px' }}
                          >
                            <TrendingUp size={15} /> Historial
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleClearProduct}
                          className="btn btn--ghost btn--sm"
                          title="Seleccionar otro producto"
                          style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Campos de Cantidad, Precio Unitario, % IVA y Botón de Agregar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                  {/* Cantidad */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Cantidad <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <input 
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="0.00"
                      value={itemForm.cantidad}
                      onChange={(e) => setItemForm({ ...itemForm, cantidad: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(e); }}
                      className="form-control"
                      style={{ width: '100%', fontSize: '1rem', fontWeight: 700 }}
                    />
                  </div>

                  {/* Precio Unitario */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Precio Unitario ($ COP) <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={itemForm.precio_unitario}
                        onChange={(e) => setItemForm({ ...itemForm, precio_unitario: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(e); }}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '1.85rem', fontSize: '1rem', fontWeight: 700 }}
                      />
                      <DollarSign size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* % IVA */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      % IVA
                    </label>
                    <select
                      value={itemForm.iva_pct}
                      onChange={(e) => setItemForm({ ...itemForm, iva_pct: e.target.value })}
                      className="form-control"
                      style={{ width: '100%' }}
                    >
                      <option value="19">19% (General)</option>
                      <option value="5">5% (Reducido)</option>
                      <option value="0">0% (Exento / Sin IVA)</option>
                    </select>
                  </div>

                  {/* Observación del Ítem */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Nota Ítem (Opcional)
                    </label>
                    <input 
                      type="text"
                      placeholder="Ej: Lote 45, repuesto taller..."
                      value={itemForm.observaciones_item}
                      onChange={(e) => setItemForm({ ...itemForm, observaciones_item: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(e); }}
                      className="form-control"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Botón Agregar Ítem */}
                  <div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProduct || !itemForm.cantidad || !itemForm.precio_unitario}
                      className="btn btn--secondary"
                      style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700 }}
                    >
                      <Plus size={18} /> Añadir Ítem
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. TABLA DE ÍTEMS DE LA FACTURA Y TOTALES */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} color="var(--clr-primary-500)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Ítems a Ingresar bajo Factura {headerForm.numero_factura ? `"${headerForm.numero_factura}"` : ''}
                    </h3>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--bg-app)', padding: '0.2rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    {items.length} {items.length === 1 ? 'ítem agregado' : 'ítems agregados'}
                  </span>
                </div>

                {/* Tabla de Líneas */}
                <div className="table-responsive" style={{ marginBottom: '1.5rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>#</th>
                        <th>Producto / Repuesto</th>
                        <th style={{ textAlign: 'right' }}>Cantidad</th>
                        <th style={{ textAlign: 'right' }}>Precio Unitario</th>
                        <th style={{ textAlign: 'center' }}>% IVA</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                        <th style={{ textAlign: 'right' }}>Total Ítem</th>
                        <th style={{ textAlign: 'center', width: '60px' }}>Quitar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length > 0 ? (
                        items.map((it, idx) => (
                          <tr key={it.temp_id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', background: 'var(--bg-app)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                                  {it.codigo_interno}
                                </span>
                                <span style={{ fontWeight: 600 }}>{it.nombre}</span>
                              </div>
                              {it.observaciones_item && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  Nota: {it.observaciones_item}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {it.cantidad} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>{it.unidad_medida}</span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(it.precio_unitario)}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                              {it.iva_pct}%
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {formatCurrency(it.subtotal)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--clr-primary-500)' }}>
                              {formatCurrency(it.total)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.temp_id)}
                                className="btn btn--ghost btn--sm"
                                title="Quitar de la factura"
                                style={{ color: 'var(--clr-danger)', padding: '0.3rem' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                              <ShoppingCart size={32} strokeWidth={1.5} />
                              <span>Aún no has agregado productos a esta factura.</span>
                              <span style={{ fontSize: 'var(--text-xs)' }}>Busca un producto arriba y haz clic en <strong>"Añadir Ítem"</strong>.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de Totales y Botón Guardar Factura Completa */}
                <div style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Subtotal Neto</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(totalesFactura.subtotal)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Total IVA</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(totalesFactura.iva_total)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Total General Factura</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--clr-primary-500)' }}>
                        {formatCurrency(totalesFactura.gran_total)}
                      </div>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleSubmitFacturaCompleta}
                    disabled={items.length === 0 || mutationRegistrar.isLoading}
                    className="btn btn--primary"
                    style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    {mutationRegistrar.isLoading ? (
                      <>
                        <div className="spinner" /> Registrando factura...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} /> Guardar Factura Completa ({items.length} {items.length === 1 ? 'ítem' : 'ítems'})
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* PESTAÑA 2: HISTORIAL DE COMPRAS                         */}
          {/* ======================================================== */}
          {activeTab === 'historial' && (
            <div>
              {/* Barra de Filtros */}
              <div className="card mb-4" style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                  
                  {/* Búsqueda rápida */}
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text"
                      placeholder="Buscar por factura, consecutivo, producto o proveedor..."
                      value={histSearch}
                      onChange={(e) => { setHistSearch(e.target.value); setHistPage(1); }}
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.25rem' }}
                    />
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  {/* Filtro Proveedor */}
                  <div>
                    <select
                      value={histProveedor}
                      onChange={(e) => { setHistProveedor(e.target.value); setHistPage(1); }}
                      className="form-control"
                      style={{ width: '100%' }}
                    >
                      <option value="">Todos los Proveedores</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.razon_social}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha Desde */}
                  <div>
                    <input 
                      type="date"
                      value={histFechaDesde}
                      onChange={(e) => { setHistFechaDesde(e.target.value); setHistPage(1); }}
                      className="form-control"
                      style={{ width: '100%' }}
                      title="Fecha desde"
                    />
                  </div>

                  {/* Fecha Hasta */}
                  <div>
                    <input 
                      type="date"
                      value={histFechaHasta}
                      onChange={(e) => { setHistFechaHasta(e.target.value); setHistPage(1); }}
                      className="form-control"
                      style={{ width: '100%' }}
                      title="Fecha hasta"
                    />
                  </div>
                </div>
              </div>

              {/* Tabla de Historial */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>N° Factura</th>
                        <th>Proveedor</th>
                        <th>Producto / Repuesto</th>
                        <th style={{ textAlign: 'right' }}>Cantidad</th>
                        <th style={{ textAlign: 'right' }}>Precio Unitario</th>
                        <th style={{ textAlign: 'right' }}>Total con IVA</th>
                        <th>Observaciones</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistorial ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                              <div className="spinner" /> Cargando historial de compras...
                            </div>
                          </td>
                        </tr>
                      ) : historialData?.compras?.length > 0 ? (
                        historialData.compras.map(c => (
                          <tr key={c.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {new Date(c.fecha_compra).toLocaleDateString('es-CO')}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {c.numero_factura}
                              </span>
                              {c.consecutivo && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {c.consecutivo}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {c.proveedor_nombre}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                NIT: {c.proveedor_nit}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', background: 'var(--bg-app)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                                  {c.producto_codigo}
                                </span>
                                <span style={{ fontWeight: 600 }}>{c.producto_nombre}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {c.categoria_nombre}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {c.cantidad} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>{c.unidad_medida}</span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(c.precio_unitario)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--clr-primary-500)' }}>
                              {formatCurrency(c.total)}
                            </td>
                            <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                              {c.observaciones || '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => setModalHistorialProd({ id: c.producto_id, nombre: c.producto_nombre, codigo_interno: c.producto_codigo })}
                                className="btn btn--secondary btn--sm"
                                title="Ver histórico de compras de este producto"
                                style={{ padding: '0.25rem 0.6rem' }}
                              >
                                <TrendingUp size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            No se encontraron compras registradas con los filtros aplicados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {historialData?.pagination?.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Página {historialData.pagination.page} de {historialData.pagination.totalPages} ({historialData.pagination.total} registros en total)
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => setHistPage(p => Math.max(1, p - 1))}
                        disabled={histPage <= 1}
                        className="btn btn--secondary btn--sm"
                      >
                        <ChevronLeft size={16} /> Anterior
                      </button>
                      <button
                        onClick={() => setHistPage(p => Math.min(historialData.pagination.totalPages, p + 1))}
                        disabled={histPage >= historialData.pagination.totalPages}
                        className="btn btn--secondary btn--sm"
                      >
                        Siguiente <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODAL DE HISTORIAL DE PRECIOS POR PRODUCTO              */}
          {/* ======================================================== */}
          {modalHistorialProd && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}>
              <div style={{ maxWidth: '700px', width: '92%', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Evolución Histórica de Precios de Compra
                    </h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {modalHistorialProd.codigo_interno} • {modalHistorialProd.nombre}
                    </p>
                  </div>
                  <button onClick={() => setModalHistorialProd(null)} className="btn btn--ghost btn--sm" style={{ padding: '0.25rem' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ padding: '1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>
                  {loadingPreciosProd ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <div className="spinner" /> Cargando historial...
                    </div>
                  ) : preciosProducto.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha Compra</th>
                          <th>Factura</th>
                          <th>Proveedor</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>Precio Unitario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preciosProducto.map((p, idx) => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: idx === 0 ? 700 : 500 }}>
                              {new Date(p.fecha_compra).toLocaleDateString('es-CO')}
                              {idx === 0 && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--clr-success)', fontWeight: 700 }}>
                                  Último
                                </span>
                              )}
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{p.numero_factura}</td>
                            <td>{p.proveedor}</td>
                            <td style={{ textAlign: 'right' }}>{p.cantidad}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--clr-primary-500)' }}>
                              {formatCurrency(p.precio_unitario)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No hay compras registradas para este producto.
                    </div>
                  )}
                </div>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'right', background: 'var(--bg-app)' }}>
                  <button onClick={() => setModalHistorialProd(null)} className="btn btn--secondary">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
