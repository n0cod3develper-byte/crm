import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';
import { 
  ArrowLeft, Edit2, Package, Wrench, MapPin, 
  Tag, Info, DollarSign, Database, FileText,
  CheckCircle2, AlertCircle, History, ZoomIn, X
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function CatalogItemDetailPage() {
  const { id } = useParams();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const navigate = useNavigate();

  const { data: itemData, isLoading, error } = useQuery({
    queryKey: ['catalog-item', id],
    queryFn: () => catalogApi.getItem(id)
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['item-movements', id],
    queryFn: async () => {
      const { data } = await api.get('/movements', { params: { inventario_id: id, limit: 100 } });
      return data;
    }
  });

  const movements = movementsData?.data || [];

  if (isLoading) return <div className="p-12 text-center">Cargando detalles del item...</div>;
  if (error || !itemData?.data) return (
    <div className="p-12 text-center">
      <AlertCircle size={48} color="var(--clr-danger)" style={{ margin: '0 auto 1rem' }} />
      <h2 className="font-bold">Error al cargar el item</h2>
      <p className="text-muted">El producto o servicio solicitado no existe o no tienes permisos.</p>
      <button onClick={() => navigate('/catalogo/items')} className="btn btn--primary mt-4">Volver al Catálogo</button>
    </div>
  );

  const item = itemData.data;

  return (
    <div className="app-layout">
      <Topbar 
        title={item.nombre_comercial || item.name} 
        subtitle={`${item.tipo} | Código: ${item.codigo_interno || 'N/A'}`}
        rightContent={
          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="btn btn--ghost flex items-center gap-2">
              <ArrowLeft size={18} /> Volver
            </button>
            <Link to={`/catalogo/${id}/editar`} className="btn btn--primary flex items-center gap-2">
              <Edit2 size={18} /> Editar Item
            </Link>
          </div>
        }
      />
      <main className="main-content">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="page-grid-2cols" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
            
            {/* Columna Principal */}
            <div className="flex flex-col gap-6">
              
              {/* Card de Información General */}
              <div className="card">
                <div style={{ display: 'flex', gap: '2rem' }}>
                  {/* Imagen (si existe) */}
                  <div 
                    onClick={() => item.imagen_url && setIsModalOpen(true)}
                    style={{ 
                      width: '200px', 
                      height: '200px', 
                      borderRadius: 'var(--radius-lg)', 
                      background: 'var(--bg-app)', 
                      border: '1px solid var(--border-color)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      overflow: 'hidden',
                      cursor: item.imagen_url ? 'zoom-in' : 'default',
                      position: 'relative'
                    }}
                    className="group"
                  >
                    {item.imagen_url ? (
                      <>
                        <img 
                          src={`/uploads/${item.imagen_url}`} 
                          alt={item.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <div style={{ 
                          position: 'absolute', 
                          inset: 0, 
                          background: 'rgba(0,0,0,0.3)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          opacity: 0, 
                          transition: 'opacity 0.2s' 
                        }} className="group-hover:opacity-100">
                          <ZoomIn size={32} color="white" />
                        </div>
                      </>
                    ) : item.tipo === 'PRODUCTO' ? (
                      <Package size={64} color="var(--text-muted)" />
                    ) : (
                      <Wrench size={64} color="var(--text-muted)" />
                    )}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${item.tipo === 'PRODUCTO' ? 'badge--primary' : 'badge--info'}`}>
                        {item.tipo}
                      </span>
                      {item.is_active ? (
                        <span className="badge badge--success flex items-center gap-1"><CheckCircle2 size={12} /> Activo</span>
                      ) : (
                        <span className="badge badge--danger flex items-center gap-1"><AlertCircle size={12} /> Inactivo</span>
                      )}
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      {item.nombre_comercial || item.name}
                    </h1>
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem' }}>
                      {item.name !== item.nombre_comercial && (
                        <div className="mb-1"><strong>Nombre Interno:</strong> {item.name}</div>
                      )}
                      <div><strong>Código de Sistema:</strong> {item.codigo_interno || item.sku || '---'}</div>
                      {item.marca && <div className="mt-1"><strong>Marca:</strong> <span style={{ color: 'var(--clr-primary-500)', fontWeight: 600 }}>{item.marca}</span></div>}
                    </div>
                    
                    <div className="grid-2cols-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Familia</div>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Tag size={14} color="var(--clr-primary-500)" /> {item.categoria_nombre || 'General'}
                        </div>
                      </div>
                      <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ubicación</div>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <MapPin size={14} color="var(--clr-danger)" /> {item.codigo_ubicacion || 'Sin asignar'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Descripciones y Especificaciones */}
              <div className="card">
                <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="var(--clr-primary-500)" /> Detalles y Especificaciones
                  </h2>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Descripción</h3>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontSize: 'var(--text-sm)' }}>
                      {item.descripcion_corta || item.description || 'Sin descripción detallada.'}
                    </p>
                  </div>
                  
                  {item.descripcion_larga && (
                    <div>
                      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Información Extendida</h3>
                      <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
                        {item.descripcion_larga}
                      </p>
                    </div>
                  )}

                  <div className="grid-2cols-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Impuestos</h3>
                      <div className="flex items-center gap-2">
                        {item.aplica_iva ? (
                          <span className="badge badge--success">IVA {item.iva_pct}%</span>
                        ) : (
                          <span className="badge">Exento de IVA</span>
                        )}
                      </div>
                    </div>
                    {item.tipo === 'PRODUCTO' && (
                      <div>
                        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Unidad de Medida</h3>
                        <span style={{ fontWeight: 600 }}>{item.unidad_medida || 'Unidad'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Historial de Movimientos */}
              <div className="card" id="movimientos">
                <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={18} color="var(--clr-primary-500)" /> Historial de Movimientos
                  </h2>
                </div>

                <div className="table-container">
                  <table className="table table--sm">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Documento</th>
                        <th style={{ textAlign: 'right' }}>Cant.</th>
                        <th style={{ textAlign: 'right' }}>Stock Final</th>
                        <th style={{ textAlign: 'right' }}>Costo Final</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementsLoading ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></td></tr>
                      ) : movements?.length === 0 ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay movimientos registrados para este item.</td></tr>
                      ) : movements?.map(m => {
                        const isPositive = m.tipo_movimiento?.startsWith('ENTRADA');
                        return (
                          <tr key={m.id}>
                            <td style={{ fontSize: 'var(--text-xs)' }}>
                              {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </td>
                            <td>
                              <div style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }} className={`badge ${m.tipo_movimiento?.startsWith('ENTRADA') ? 'badge--success' : 'badge--danger'}`}>
                                {m.tipo_movimiento?.split('_')[0]}
                              </div>
                            </td>
                            <td style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                              {m.tipo_documento}: {m.numero_documento || 'S/N'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: isPositive ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                              {isPositive ? '+' : '-'}{m.cantidad}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {m.stock_despues}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {formatCurrency(m.costo_promedio_despues || 0)}
                            </td>
                            <td style={{ fontSize: '0.75rem', maxWidth: '150px' }} className="truncate">
                              {m.notas || '---'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Columna Lateral (KPIs y Acciones Rápidas) */}
            <div className="flex flex-col gap-6">
              
              {/* Card de Precios */}
              <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Precio de Venta Sugerido
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--clr-primary-500)' }}>
                    {formatCurrency(item.precio_venta ?? 0)}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {item.aplica_iva ? '+ IVA' : 'IVA Incluido / No aplica'}
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span className="text-muted">Costo / Base:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(item.costo_o_minimo ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span className="text-muted">Margen Estimado:</span>
                    <span style={{ fontWeight: 600, color: 'var(--clr-success)' }}>
                      {(item.precio_venta > 0) ? (((item.precio_venta - (item.costo_o_minimo ?? 0)) / item.precio_venta) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Card de Stock (Solo Productos) */}
              {item.tipo === 'PRODUCTO' && (
                <div className="card">
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={16} color="var(--clr-warning)" /> Disponibilidad Física
                  </h3>
                  
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 800, color: (item.stock_actual ?? 0) <= (item.stock_minimo ?? 0) ? 'var(--clr-danger)' : 'var(--text-primary)' }}>
                      {item.stock_actual ?? 0}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{item.unidad_medida || 'Unidades'} en bodega</div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div style={{ padding: '0.75rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                      <span>Stock Mínimo:</span>
                      <span style={{ fontWeight: 700 }}>{item.stock_minimo ?? 0}</span>
                    </div>
                    {(item.stock_actual ?? 0) <= (item.stock_minimo ?? 0) && (
                      <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--clr-danger)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <AlertCircle size={14} /> Requiere reposición inmediata
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Acciones de Negocio */}
              <div className="flex flex-col gap-2">
                <button className="btn btn--secondary flex items-center justify-center gap-2 w-full">
                  <History size={18} /> Ver Historial de Movimientos
                </button>
                <button className="btn btn--ghost flex items-center justify-center gap-2 w-full">
                  <FileText size={18} /> Imprimir Ficha Técnica
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Modal de Imagen Ampliada */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out',
            animation: 'fade-in 0.3s ease'
          }}
        >
          <button 
            onClick={() => setIsModalOpen(false)}
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
          <img 
            src={`/uploads/${item.imagen_url}`} 
            alt={item.name} 
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
