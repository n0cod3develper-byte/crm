import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { Package, Wrench, AlertTriangle, List, Plus, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';

export function CatalogDashboardPage() {
  const { data: categorias } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  const { data: alertas } = useQuery({
    queryKey: ['catalog-alerts'],
    queryFn: () => catalogApi.getAlertas()
  });

  const totals = categorias?.data?.reduce((acc, cat) => {
    acc.productos += parseInt(cat.total_productos || 0);
    acc.servicios += parseInt(cat.total_servicios || 0);
    return acc;
  }, { productos: 0, servicios: 0 }) || { productos: 0, servicios: 0 };

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Catálogo Unificado" 
        subtitle="Gestión de Productos e Inventario + Servicios Profesionales"
        rightContent={
          <div className="flex gap-3">
            <Link to="/catalogo/familias" className="btn btn--ghost flex items-center gap-2">
              <Layers size={18} /> Gestionar Familias
            </Link>
            <Link to="/catalogo/items" className="btn btn--secondary flex items-center gap-2">
              <List size={18} /> Ver Catálogo
            </Link>
            <Link to="/catalogo/nuevo" className="btn btn--primary flex items-center gap-2">
              <Plus size={18} /> Nuevo Item
            </Link>
          </div>
        }
      />
      <main className="main-content">
        <div className="animate-in fade-in duration-500">
          
          {/* Métricas */}
          <div className="kpi-grid mb-6">
            <MetricCard 
              icon={<Package size={20} />} 
              label="Total Productos" 
              value={totals.productos} 
              sublabel="Con control de stock"
            />
            <MetricCard 
              icon={<Wrench size={20} />} 
              label="Total Servicios" 
              value={totals.servicios} 
              sublabel="Mano de obra y servicios"
            />
            <MetricCard 
              icon={<AlertTriangle size={20} />} 
              label="Alertas de Stock" 
              value={alertas?.data?.length || 0} 
              sublabel="Stock bajo o agotado"
              isAlert={alertas?.data?.length > 0}
            />
            <MetricCard 
              icon={<List size={20} />} 
              label="Familias" 
              value={categorias?.data?.length || 0} 
              sublabel="Configuradas"
            />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Alertas de Stock */}
            <div className="card" style={{ flex: '2 1 600px' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="var(--clr-warning)" /> Alertas Críticas de Inventario
              </h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Familia</th>
                      <th>Stock</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas?.data?.length > 0 ? alertas.data.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.nombre_comercial}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{item.codigo_interno}</div>
                        </td>
                        <td>{item.categoria}</td>
                        <td style={{ fontWeight: 600, color: 'var(--clr-danger)' }}>
                          {item.stock_actual} {item.unidad}
                        </td>
                        <td>
                          <span className={`badge ${item.tipo_alerta === 'AGOTADO' ? 'badge--danger' : 'badge--warning'}`}>
                            {item.tipo_alerta}
                          </span>
                        </td>
                        <td>
                          <Link to={`/compras/oc/nueva?item=${item.id}`} className="btn btn--secondary btn--sm">
                            Reponer
                          </Link>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No hay alertas de stock pendientes. ¡Buen trabajo!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Categorías Quick View */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Por Familia</h2>
              <div className="flex flex-col gap-2">
                {categorias?.data?.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
                    <div className="flex items-center gap-3">
                      <div 
                        style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', backgroundColor: cat.color_hex || 'var(--clr-gray-500)' }}
                      >
                        <List size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{cat.nombre}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{parseInt(cat.total_productos) + parseInt(cat.total_servicios)} items</div>
                      </div>
                    </div>
                    <Link to={`/catalogo/items?categoria=${cat.slug}`} style={{ color: 'var(--text-muted)' }} className="hover:color-primary">
                      <List size={18} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, sublabel, isAlert }) {
  return (
    <div className="kpi-card" style={{ borderLeft: isAlert ? '4px solid var(--clr-warning)' : 'none' }}>
      <div className="flex justify-between items-center">
        <div className="kpi-label">{label}</div>
        <div style={{ color: isAlert ? 'var(--clr-warning)' : 'var(--clr-primary-500)' }}>
          {icon}
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-delta text-muted">{sublabel}</div>
    </div>
  );
}
