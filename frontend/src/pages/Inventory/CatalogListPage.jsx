import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { 
  Search, Filter, Plus, Package, Wrench, MoreHorizontal, ChevronRight, 
  ChevronLeft, Image as ImageIcon, FileSpreadsheet, Upload, Download,
  ArrowUpDown, ArrowUp, ArrowDown, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useQueryClient } from '@tanstack/react-query';
import { StockAdjustModal } from '../../components/Inventory/StockAdjustModal';
import { CatalogImportModal } from '../../components/Inventory/CatalogImportModal';
import { Topbar } from '../../components/layout/Topbar';

export function CatalogListPage() {
  const [tipo, setTipo] = useState('todos');
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sortBy, setSortBy] = useState('nombre_comercial');
  const [sortDir, setSortDir] = useState('ASC');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { puede } = usePermissions();
  const queryClient = useQueryClient();
  const [stockModalItem, setStockModalItem] = useState(null);

  const handleStockAdjustSuccess = () => {
    queryClient.invalidateQueries(['catalog-items']);
  };

  const openStockModal = (item) => {
    setStockModalItem(item);
  };

  const closeStockModal = () => {
    setStockModalItem(null);
  };

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['catalog-items', tipo, categoria, search, page, limit, sortBy, sortDir],
    queryFn: () => catalogApi.getItems({ tipo, categoria, search, page, limit, sort_by: sortBy, sort_dir: sortDir }),
    keepPreviousData: true,
    staleTime: 0,
  });

  const { data: catData } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  const { data: uniData } = useQuery({
    queryKey: ['catalog-units'],
    queryFn: () => catalogApi.getUnidades()
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      if (sortDir === 'ASC') {
        setSortDir('DESC');
      } else {
        // Volver al orden por defecto
        setSortBy('nombre_comercial');
        setSortDir('ASC');
      }
    } else {
      setSortBy(field);
      setSortDir('ASC');
    }
    setPage(1);
  };

  const handleExportExcel = async () => {
    try {
      toast.loading('Generando archivo Excel...', { id: 'export-cat' });
      
      const res = await catalogApi.getInforme({
        tipo: tipo !== 'todos' ? tipo : undefined,
        search: search || undefined,
        categoria_id: categoria || undefined,
        limit: 10000
      });

      const items = res?.items || [];
      if (!items.length) {
        toast.error('No hay registros para exportar con los filtros seleccionados', { id: 'export-cat' });
        return;
      }

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

      const todayStr = new Date().toISOString().split('T')[0];
      const tipoStr = tipo.toLowerCase();
      const filename = `Catalogo_Productos_Servicios_${tipoStr}_${todayStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success('Catálogo descargado correctamente en Excel', { id: 'export-cat' });
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el archivo Excel', { id: 'export-cat' });
    }
  };

  const renderSortIcon = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.35, marginLeft: '5px', verticalAlign: 'middle' }} />;
    }
    return sortDir === 'ASC' ? (
      <ArrowUp size={13} style={{ color: 'var(--clr-primary-500)', marginLeft: '5px', verticalAlign: 'middle' }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--clr-primary-500)', marginLeft: '5px', verticalAlign: 'middle' }} />
    );
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Explorar Catálogo" 
        subtitle="Listado unificado de familias de productos y servicios profesionales"
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link 
              to="/catalogo/familias" 
              className="btn btn--secondary flex items-center gap-2"
              title="Gestionar familias de productos y sus consecutivos"
            >
              <Layers size={18} /> Familias
            </Link>
            <button 
              type="button" 
              onClick={handleExportExcel}
              className="btn btn--secondary flex items-center gap-2"
              title="Descargar catálogo de producto en Excel (.xlsx)"
            >
              <FileSpreadsheet size={18} color="#16a34a" /> Exportar Excel
            </button>
            <button 
              type="button" 
              onClick={() => setIsImportModalOpen(true)}
              className="btn btn--secondary flex items-center gap-2"
              title="Importar o actualizar productos masivamente vía Excel"
            >
              <FileSpreadsheet size={18} color="var(--clr-success)" /> Importar Excel
            </button>
            <Link to="/catalogo/nuevo" className="btn btn--primary flex items-center gap-2">
              <Plus size={18} /> Nuevo Item
            </Link>
          </div>

        }
      />
      <main className="main-content">
        <div className="animate-in fade-in duration-500">
          
          <div className="card mb-6" style={{ padding: '1rem' }}>
            <div className="catalog-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Tabs de Tipo */}
              <div style={{ display: 'flex', background: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                <button 
                  onClick={() => { setTipo('todos'); setPage(1); }}
                  style={{ flex: 1, border: 'none', background: tipo === 'todos' ? 'var(--bg-surface)' : 'transparent', color: tipo === 'todos' ? 'var(--clr-primary-500)' : 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', boxShadow: tipo === 'todos' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                >
                  Todos
                </button>
                <button 
                  onClick={() => { setTipo('PRODUCTO'); setPage(1); }}
                  style={{ flex: 1, border: 'none', background: tipo === 'PRODUCTO' ? 'var(--bg-surface)' : 'transparent', color: tipo === 'PRODUCTO' ? 'var(--clr-primary-500)' : 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', boxShadow: tipo === 'PRODUCTO' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                >
                  Productos
                </button>
                <button 
                  onClick={() => { setTipo('SERVICIO'); setPage(1); }}
                  style={{ flex: 1, border: 'none', background: tipo === 'SERVICIO' ? 'var(--bg-surface)' : 'transparent', color: tipo === 'SERVICIO' ? 'var(--clr-primary-500)' : 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', boxShadow: tipo === 'SERVICIO' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                >
                  Servicios
                </button>
              </div>

              {/* Buscador */}
              <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, código interno o referencia…"
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              {/* Familia */}
              <div style={{ position: 'relative' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <select 
                  className="input"
                  style={{ paddingLeft: '2.5rem', appearance: 'none' }}
                  value={categoria}
                  onChange={(e) => { setCategoria(e.target.value); setPage(1); }}
                >
                  <option value="">Todas las Familias</option>
                  {catData?.data?.map(c => (
                    <option key={c.id} value={c.slug}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('nombre_comercial')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Ordenar por Item / Nombre Comercial"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Item / Marca {renderSortIcon('nombre_comercial')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('categoria_nombre')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Ordenar por Familia"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Familia {renderSortIcon('categoria_nombre')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('codigo_ubicacion')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Ordenar por Consecutivo de Ubicación"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Ubicación {renderSortIcon('codigo_ubicacion')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('stock_actual')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Ordenar por Stock"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Stock / Cobro {renderSortIcon('stock_actual')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('precio_venta')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Ordenar por Precio de Venta"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Precio Venta {renderSortIcon('precio_venta')}
                    </span>
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
                        <div className="spinner" /> Cargando catálogo...
                      </div>
                    </td>
                  </tr>
                ) : itemsData?.items?.length > 0 ? itemsData.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-4">
                        <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {item.imagen_thumb_url ? (
                            <img 
                              src={`/uploads/${item.imagen_thumb_url}`} 
                              alt={item.nombre_comercial} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                          ) : item.tipo === 'PRODUCTO' ? (
                            <Package size={24} color="var(--text-muted)" />
                          ) : (
                            <Wrench size={24} color="var(--text-muted)" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {item.nombre_comercial}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'var(--bg-app)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {item.codigo_interno}
                            </span>
                            {(item.referencia_fabricante || (item.nombre_interno && item.nombre_interno !== item.codigo_interno && item.nombre_interno !== item.nombre_comercial)) && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: 'var(--clr-info)', textTransform: 'uppercase' }}>
                                Ref: {item.referencia_fabricante || item.nombre_interno}
                              </span>
                            )}
                            {item.marca && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: 'var(--clr-success)', textTransform: 'uppercase' }}>
                                {item.marca}
                              </span>
                            )}
                            {item.tipo === 'SERVICIO' && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'rgba(99,102,241,0.1)', color: 'var(--clr-primary-500)', textTransform: 'uppercase' }}>
                                Servicio
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.categoria_color || 'var(--clr-gray-500)' }}
                        />
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{item.categoria_nombre}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.codigo_ubicacion || '---'}
                      </span>
                    </td>
                    <td>
                      {item.tipo === 'PRODUCTO' ? (
                        <div className="flex flex-col">
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: item.stock_actual <= item.stock_minimo ? 'var(--clr-danger)' : 'var(--text-primary)' }}>
                            {item.stock_actual} {item.unidad_medida}
                          </span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Mínimo: {item.stock_minimo}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--clr-primary-500)', textTransform: 'uppercase' }}>
                          Por {item.unidad_cobro || 'unidad'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(item.precio_venta)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {puede('catalogo', 'editar') && (
                          <button onClick={() => openStockModal(item)} className="btn btn--primary btn--sm" title="Ajustar stock">
                            Ajustar
                          </button>
                        )}
                        <Link 
                          to={`/catalogo/${item.id}/editar`}
                          className="btn btn--ghost btn--sm"
                          title="Editar item"
                        >
                          <MoreHorizontal size={18} />
                        </Link>
                        <Link 
                          to={`/catalogo/${item.id}`}
                          className="btn btn--secondary btn--sm"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      No se encontraron items con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Paginación */}
            {itemsData && itemsData.total > 0 && (
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, itemsData.total)} de {itemsData.total} registros
                </span>
                {itemsData.totalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <button 
                      className="btn btn--ghost btn--sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))} 
                      disabled={page === 1} 
                      style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      title="Página anterior"
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    
                    {Array.from({ length: Math.min(5, itemsData.totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(page - 2, itemsData.totalPages - 4)) + i;
                      if (pageNum > itemsData.totalPages) return null;
                      return (
                        <button 
                          key={pageNum} 
                          className={`btn btn--sm ${pageNum === page ? 'btn--primary' : 'btn--ghost'}`}
                          onClick={() => setPage(pageNum)} 
                          style={{ minWidth: '32px', padding: '0.35rem 0.5rem', fontWeight: pageNum === page ? 700 : 500 }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button 
                      className="btn btn--ghost btn--sm" 
                      onClick={() => setPage(p => Math.min(itemsData.totalPages, p + 1))} 
                      disabled={page === itemsData.totalPages} 
                      style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      title="Página siguiente"
                    >
                      Siguiente <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <StockAdjustModal item={stockModalItem} isOpen={!!stockModalItem} onClose={closeStockModal} onSuccess={handleStockAdjustSuccess} />
          <CatalogImportModal 
            isOpen={isImportModalOpen} 
            onClose={() => setIsImportModalOpen(false)} 
            onSuccess={() => {
              queryClient.invalidateQueries(['catalog-items']);
            }}
            familias={catData?.data || []}
            unidades={uniData?.data || []}
          />
        </div>
      </main>
    </div>
  );
}
