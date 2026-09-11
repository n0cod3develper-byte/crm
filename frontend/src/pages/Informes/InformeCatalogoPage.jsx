import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Package, Wrench, Download, RefreshCw, Search, Calendar, 
  Layers, ChevronLeft, ChevronRight, Box 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { catalogApi } from '../../services/catalogApi';
import { Topbar } from '../../components/layout/Topbar';
import { formatCurrency } from '../../utils/formatters';

export function InformeCatalogoPage() {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['catalog-informe', fechaDesde, fechaHasta, tipo, search, categoria],
    queryFn: () => catalogApi.getInforme({
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      tipo: tipo !== 'todos' ? tipo : undefined,
      search: search || undefined,
      categoria_id: categoria || undefined,
      limit: 10000
    }),
    keepPreviousData: true
  });

  const { data: catData } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  const summary = data?.summary || {
    total_registros: 0,
    total_productos: 0,
    total_servicios: 0,
    total_stock: 0,
    valor_inventario_costo: 0,
    valor_inventario_venta: 0
  };

  const items = data?.items || [];
  const totalPages = Math.ceil(items.length / pageSize) || 1;

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const handleExportExcel = () => {
    if (!items || items.length === 0) {
      toast.error('No hay registros para exportar con los filtros seleccionados');
      return;
    }

    try {
      toast.loading('Generando archivo Excel...', { id: 'export-cat' });

      const rows = items.map((item) => ({
        'Tipo': item.tipo === 'PRODUCTO' ? 'Producto' : 'Servicio',
        'Código Interno': item.codigo_interno || '—',
        'Nombre Comercial': item.nombre_comercial || '—',
        'Nombre Interno / Ref': item.nombre_interno || '—',
        'Referencia Fabricante': item.referencia_fabricante || '—',
        'Referencia Sistema (SKU)': item.referencia_sistema || '—',
        'Marca': item.marca || '—',
        'Familia / Categoría': item.categoria_nombre || '—',
        'Área': item.area || '—',
        'Ubicación Física': item.codigo_ubicacion || '—',
        'Unidad de Medida': item.unidad_medida || '—',
        'Stock Actual': item.tipo === 'PRODUCTO' ? Number(item.stock_actual || 0) : 'N/A',
        'Stock Mínimo': item.tipo === 'PRODUCTO' ? Number(item.stock_minimo || 0) : 'N/A',
        'Precio Venta': Number(item.precio_venta || 0),
        'Costo Reposición / Mínimo': Number(item.costo_o_minimo || 0),
        'Aplica IVA': item.aplica_iva ? 'SÍ' : 'NO',
        '% IVA': item.iva_pct ? Number(item.iva_pct) : 0,
        'Estado': item.is_active ? 'Activo' : 'Inactivo',
        'Fecha de Creación': item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '—'
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length + 4, 14)
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');

      const dateStr = [
        fechaDesde || 'inicio',
        fechaHasta || 'actual'
      ].join('_a_');

      const tipoStr = tipo.toLowerCase();
      const filename = `Informe_Catalogo_${tipoStr}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success('Informe Excel descargado correctamente', { id: 'export-cat' });
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el archivo Excel', { id: 'export-cat' });
    }
  };

  const handleResetFilters = () => {
    setFechaDesde('');
    setFechaHasta('');
    setTipo('todos');
    setSearch('');
    setCategoria('');
    setPage(1);
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Informe de Catálogo" 
        subtitle="Consulta y descarga de información de productos y servicios por rango de fechas"
        rightContent={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              className="btn btn--secondary flex items-center gap-2" 
              onClick={() => refetch()} 
              title="Actualizar datos"
              disabled={isFetching}
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button 
              className="btn btn--primary flex items-center gap-2" 
              onClick={handleExportExcel}
              disabled={items.length === 0}
              title="Descargar informe en Excel (.xlsx)"
            >
              <Download size={16} />
              <span>Exportar Excel</span>
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* Barra de Filtros */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            {/* Fecha Desde */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                <Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Fecha Creación Desde
              </label>
              <input 
                type="date" 
                className="input"
                value={fechaDesde} 
                onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }} 
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                <Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Fecha Creación Hasta
              </label>
              <input 
                type="date" 
                className="input"
                value={fechaHasta} 
                onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }} 
              />
            </div>

            {/* Tipo (Productos / Servicios / Todos) */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Tipo de Catálogo
              </label>
              <select 
                className="input"
                value={tipo}
                onChange={(e) => { setTipo(e.target.value); setPage(1); }}
              >
                <option value="todos">Todos (Productos y Servicios)</option>
                <option value="PRODUCTO">Solo Productos (Inventario)</option>
                <option value="SERVICIO">Solo Servicios</option>
              </select>
            </div>

            {/* Familia / Categoría */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                <Layers size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Familia / Categoría
              </label>
              <select 
                className="input"
                value={categoria}
                onChange={(e) => { setCategoria(e.target.value); setPage(1); }}
              >
                <option value="">Todas las Familias</option>
                {catData?.data?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Búsqueda general */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Búsqueda Rápida
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Nombre, código, referencia…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          {/* Botón para restablecer */}
          {(fechaDesde || fechaHasta || tipo !== 'todos' || search || categoria) && (
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn--ghost btn--sm" 
                onClick={handleResetFilters}
              >
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>

        {/* Tarjetas KPI de Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Registros</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary.total_registros}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>En el período seleccionado</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Productos</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
              {summary.total_productos}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Con control de stock</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Servicios</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6366f1' }}>
              {summary.total_servicios}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Mano de obra y servicios</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Stock Acumulado</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
              {Number(summary.total_stock || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Unidades físicas</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Valor Inventario (Costo)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatCurrency(summary.valor_inventario_costo)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Costo de reposición</div>
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              Cargando informe de catálogo...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                No se encontraron registros
              </h3>
              <p style={{ fontSize: '0.875rem' }}>
                Prueba cambiando los filtros de fecha o tipo de catálogo.
              </p>
            </div>
          ) : (
            <>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Código</th>
                      <th>Nombre Comercial</th>
                      <th>Referencia</th>
                      <th>Familia</th>
                      <th>Marca</th>
                      <th style={{ textAlign: 'right' }}>Stock</th>
                      <th style={{ textAlign: 'right' }}>Precio Venta</th>
                      <th style={{ textAlign: 'right' }}>Costo / Mínimo</th>
                      <th>Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.tipo === 'PRODUCTO' ? (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '0.2rem 0.5rem', borderRadius: '4px', 
                              fontSize: '0.75rem', fontWeight: 700, 
                              background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' 
                            }}>
                              <Package size={12} /> Producto
                            </span>
                          ) : (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '0.2rem 0.5rem', borderRadius: '4px', 
                              fontSize: '0.75rem', fontWeight: 700, 
                              background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' 
                            }}>
                              <Wrench size={12} /> Servicio
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {item.codigo_interno || '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.nombre_comercial}</div>
                          {item.nombre_interno && item.nombre_interno !== item.nombre_comercial && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.nombre_interno}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {item.referencia_fabricante || item.referencia_sistema || '—'}
                        </td>
                        <td>
                          <span style={{ 
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem', borderRadius: '4px',
                            fontSize: '0.75rem', fontWeight: 600,
                            background: 'var(--bg-elevated)', color: 'var(--text-primary)'
                          }}>
                            {item.categoria_nombre || 'Sin Familia'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{item.marca || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {item.tipo === 'PRODUCTO' ? Number(item.stock_actual || 0).toLocaleString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(item.precio_venta)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {formatCurrency(item.costo_o_minimo)}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barra de paginación */}
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)',
                flexWrap: 'wrap', gap: '0.75rem'
              }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, items.length)} de {items.length} registros
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    className="btn btn--secondary btn--sm" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
                    Página {page} de {totalPages}
                  </span>
                  <button 
                    className="btn btn--secondary btn--sm" 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Siguiente <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
