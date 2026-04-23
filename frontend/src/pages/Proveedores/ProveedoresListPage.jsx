import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, ShoppingBag, Phone, Mail, 
  MapPin, Star, MoreVertical, Filter,
  Building2, Globe, ShieldCheck, AlertCircle
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import api from '../../lib/api';

export function ProveedoresListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterEstado, setFilterEstado] = React.useState('all');

  const { data: proveedores, isLoading } = useQuery({
    queryKey: ['proveedores', filterEstado],
    queryFn: async () => {
      const { data } = await api.get('/proveedores', {
        params: { estado: filterEstado !== 'all' ? filterEstado : undefined }
      });
      return data.data || data || [];
    },
  });

  const filteredProveedores = React.useMemo(() => {
    if (!proveedores) return [];
    return proveedores.filter(p => 
      p.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.numero_documento.includes(searchTerm) ||
      (p.nombre_comercial && p.nombre_comercial.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [proveedores, searchTerm]);

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'ACTIVO':        return <span className="badge badge--success">Activo</span>;
      case 'INACTIVO':      return <span className="badge badge--gray">Inactivo</span>;
      case 'BLOQUEADO':     return <span className="badge badge--danger">Bloqueado</span>;
      case 'EN_EVALUACION': return <span className="badge badge--warning">Evaluación</span>;
      default:              return <span className="badge badge--gray">{estado}</span>;
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            size={12} 
            fill={star <= (rating || 0) ? "#f59e0b" : "transparent"} 
            color={star <= (rating || 0) ? "#f59e0b" : "var(--text-muted)"} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <header className="header">
        <div className="flex items-center gap-3">
          <div style={{ padding: '0.5rem', background: 'var(--clr-primary-500)', borderRadius: 'var(--radius-md)' }}>
             <Building2 color="white" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Catálogo de Proveedores</h1>
            <p className="text-sm text-muted">Directorio centralizado de suministros y servicios</p>
          </div>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/proveedores/nuevo')}>
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </header>

      <main className="main-content">
        {/* Filters and Search */}
        <div className="card mb-6" style={{ padding: '1rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                className="input" 
                placeholder="Buscar por nombre, NIT o razón social..." 
                style={{ paddingLeft: '2.5rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted" />
              <select 
                className="input" 
                style={{ width: '160px', padding: '0.5rem' }}
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="ACTIVO">Activos</option>
                <option value="EN_EVALUACION">En Evaluación</option>
                <option value="INACTIVO">Inactivos</option>
                <option value="BLOQUEADO">Bloqueados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="spinner" style={{ width: '3rem', height: '3rem' }} />
          </div>
        ) : filteredProveedores.length === 0 ? (
          <div className="card empty-state">
            <AlertCircle size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">No se encontraron proveedores</h2>
            <p className="empty-state__desc">Intenta ajustar los criterios de búsqueda o registra uno nuevo.</p>
            <button className="btn btn--primary mt-4" onClick={() => navigate('/proveedores/nuevo')}>
              Registrar primer proveedor
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {filteredProveedores.map((p) => (
              <div 
                key={p.id} 
                className="card card--interactive" 
                onClick={() => navigate(`/proveedores/${p.id}`)}
                style={{ padding: '1.25rem', position: 'relative' }}
              >
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
                  {getStatusBadge(p.estado)}
                </div>

                <div className="flex gap-4 mb-4">
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem', fontWeight: 800, color: 'var(--clr-primary-500)',
                    border: '1px solid var(--border-color)'
                  }}>
                    {p.razon_social.charAt(0)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '0.125rem' }} className="truncate">
                      {p.razon_social}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {p.tipo_documento}: {p.numero_documento}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div className="flex items-center gap-2 text-sm text-secondary">
                    <Phone size={14} className="text-muted" />
                    <span>{p.telefono_principal}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-secondary truncate">
                    <Mail size={14} className="text-muted" />
                    <span>{p.email_principal}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-secondary truncate">
                    <MapPin size={14} className="text-muted" />
                    <span>{p.ciudad}, {p.pais}</span>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 700 }}>Calificación</div>
                    {renderStars(p.calificacion_promedio || 0)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn--sm btn--ghost" 
                      style={{ padding: '0.4rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/proveedores/${p.id}/editar`);
                      }}
                    >
                      Editar
                    </button>
                    <button className="btn btn--sm btn--ghost" style={{ padding: '0.4rem' }}>
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
