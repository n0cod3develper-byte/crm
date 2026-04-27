import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, Phone, Globe, MapPin, Calendar, 
  Users, TrendingUp, History, ArrowLeft, 
  Edit2, Plus, Mail, MessageSquare, Truck, FileText, Receipt
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { formatCurrency } from '../../utils/formatters';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { ContactForm } from '../../components/Contacts/ContactForm';
import { EquipoForm } from '../../components/Equipos/EquipoForm';
import { DocumentosList } from '../../components/documentos/DocumentosList';
import { DocumentoUploader } from '../../components/documentos/DocumentoUploader';
import api from '../../lib/api';

export function CompanyDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = React.useState('timeline');
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);
  const [isEquipoModalOpen, setIsEquipoModalOpen] = React.useState(false);
  const [isDocumentoModalOpen, setIsDocumentoModalOpen] = React.useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${id}`);
      return data.data;
    }
  });

  const { data: timeline, isLoading: isTimelineLoading } = useQuery({
    queryKey: ['company-timeline', id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${id}/timeline`);
      return data.data;
    }
  });

  const { data: contactsData, isLoading: isContactsLoading } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { companyId: id } });
      return data.data;
    }
  });

  const { data: equiposData, isLoading: isEquiposLoading } = useQuery({
    queryKey: ['company-equipos', id],
    queryFn: async () => {
      const { data } = await api.get(`/equipos/by-company/${id}`);
      return data.data;
    }
  });

  if (isLoading) return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content flex items-center justify-center">
        <div className="spinner" />
      </div>
    </div>
  );

  if (!company) return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="empty-state">
          <h2>Empresa no encontrada</h2>
          <Link to="/companies" className="btn btn--primary">Volver</Link>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'timeline', label: 'Actividad', icon: History },
    { id: 'contacts', label: 'Contactos', icon: Users },
    { id: 'equipos', label: 'Equipos', icon: Truck },
    { id: 'facturacion', label: 'Facturación', icon: Receipt },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'opportunities', label: 'Oportunidades', icon: TrendingUp },
    { id: 'info', label: 'Información General', icon: Building2 },
  ];

  return (
    <div className="app-layout">
      <Sidebar />

      <Topbar 
        title={company.name} 
        subtitle={`NIT: ${company.nit || 'Sin NIT'} · Creado el ${new Date(company.created_at).toLocaleDateString()}`} 
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to="/companies" className="btn btn--ghost btn--sm">
              <ArrowLeft size={16} />
            </Link>
            <button className="btn btn--secondary">
              <Edit2 size={16} /> Editar info
            </button>
          </div>
        } 
      />

      <main className="main-content" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1.5rem' }}>
        
        {/* Columna Principal */}
        <div className="flex flex-col gap-6">
          
          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '0.5rem'
          }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 0',
                    borderBottom: `2px solid ${isActive ? 'var(--clr-primary-500)' : 'transparent'}`,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    background: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="card" style={{ minHeight: '400px' }}>
            {activeTab === 'timeline' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 style={{ fontWeight: 700 }}>Actividad Reciente</h3>
                  <div className="flex gap-2">
                    <button className="btn btn--ghost btn--sm"><Mail size={14} /> Registrar Email</button>
                    <button className="btn btn--ghost btn--sm"><MessageSquare size={14} /> Nota</button>
                  </div>
                </div>
                {timeline?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay actividades registradas aún.
                  </div>
                ) : (
                  timeline?.map((item, idx) => (
                    <div key={idx} style={{ 
                      padding: '1rem', 
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: '1rem' 
                    }}>
                      <div style={{ 
                        width: 32, height: 32, borderRadius: '50%', 
                        background: 'var(--bg-elevated)', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center' 
                      }}>
                        {item.item_type === 'communication' ? <Mail size={14} /> : <TrendingUp size={14} />}
                      </div>
                      <div className="w-full">
                        <div className="flex justify-between">
                          <span style={{ fontWeight: 600 }}>{item.subject}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {new Date(item.date).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          {item.body || 'Sin descripción'}
                        </p>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                           Por: {item.created_by_name}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'contacts' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 style={{ fontWeight: 700 }}>Contactos en esta empresa</h3>
                  <button className="btn btn--primary btn--sm" onClick={() => setIsContactModalOpen(true)}>
                    <Plus size={14} /> Nuevo contacto
                  </button>
                </div>
                
                {isContactsLoading ? (
                  <div className="spinner" />
                ) : contactsData?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay contactos registrados para esta empresa.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table style={{ background: 'transparent' }}>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Cargo</th>
                          <th>Email</th>
                          <th>Teléfono</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactsData.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{c.position || '—'}</td>
                            <td>{c.email || '—'}</td>
                            <td>{c.phone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'equipos' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 style={{ fontWeight: 700 }}>Flota de Equipos</h3>
                  <button className="btn btn--primary btn--sm" onClick={() => setIsEquipoModalOpen(true)}>
                    <Plus size={14} /> Registrar equipo
                  </button>
                </div>
                {isEquiposLoading ? (
                  <div className="spinner" />
                ) : equiposData?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay equipos registrados para esta empresa.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table style={{ background: 'transparent' }}>
                      <thead>
                        <tr>
                          <th>Marca / Modelo</th>
                          <th>Serial</th>
                          <th>Motor</th>
                          <th>Capacidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equiposData.map(eq => (
                          <tr key={eq.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{eq.marca}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{eq.modelo}</div>
                            </td>
                            <td><code>{eq.serial}</code></td>
                            <td>{eq.motor}</td>
                            <td>{eq.capacidad_carga} T</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'opportunities' && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No hay oportunidades abiertas para esta empresa.</p>
                <button className="btn btn--primary mt-4"><Plus size={16} /> Crear negocio</button>
              </div>
            )}

            {activeTab === 'documentos' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 style={{ fontWeight: 700 }}>Documentos de la Empresa</h3>
                  <button className="btn btn--primary btn--sm" onClick={() => setIsDocumentoModalOpen(true)}>
                    <Plus size={14} /> Subir documento
                  </button>
                </div>
                <DocumentosList entidadTipo="EMPRESA" entidadId={id} />
              </div>
            )}

            {activeTab === 'facturacion' && (
              <CompanyFacturacionSection companyId={id} />
            )}

            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                   <label className="input-label">Dirección</label>
                   <p className="mb-4">{company.address || 'No definida'}</p>
                   
                   <label className="input-label">Ciudad / País</label>
                   <p className="mb-4">{company.city || '—'} / {company.country || 'Colombia'}</p>
                   
                   <label className="input-label">Notas Internas</label>
                   <p style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
                     {company.notes || 'No hay notas adicionales.'}
                   </p>
                </div>
                <div>
                   <label className="input-label">Tags</label>
                   <div className="flex flex-wrap gap-2 mb-4">
                     {company.tags?.map(t => <span key={t} className="badge badge--gray">{t}</span>)}
                     {!company.tags?.length && 'Sin etiquetas'}
                   </div>
                   
                   <label className="input-label">Responsable</label>
                   <p>{company.assigned_to_name || 'Sin asignar'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna Lateral (Quick Info) */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>Contacto Rápido</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div style={{ color: 'var(--text-muted)' }}><Phone size={16} /></div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Teléfono</div>
                  <div style={{ fontWeight: 500 }}>{company.phone || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ color: 'var(--text-muted)' }}><Globe size={16} /></div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Sitio Web</div>
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noreferrer" className="link" style={{ fontWeight: 500 }}>
                      Visitar sitio
                    </a>
                  ) : 'N/A'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ color: 'var(--text-muted)' }}><MapPin size={16} /></div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Ubicación</div>
                  <div style={{ fontWeight: 500 }}>{company.city || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>Resumen Comercial</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
               <div className="flex justify-between">
                 <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Contactos</span>
                 <span style={{ fontWeight: 600 }}>{contactsData?.length || 0}</span>
               </div>
               <div className="flex justify-between">
                 <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Equipos</span>
                 <span style={{ fontWeight: 600 }}>{equiposData?.length || 0}</span>
               </div>
               <div className="flex justify-between">
                 <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Pipeline Total</span>
                 <span style={{ fontWeight: 600 }}>$0</span>
               </div>
               <div className="flex justify-between">
                 <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Último contacto</span>
                 <span style={{ fontSize: 'var(--text-xs)' }}>—</span>
               </div>
            </div>
          </div>
        </div>

      </main>

      {isContactModalOpen && (
        <Modal 
          title="Agregar Contacto" 
          onClose={() => setIsContactModalOpen(false)}
        >
          <ContactForm 
            defaultCompanyId={id}
            onSuccess={() => setIsContactModalOpen(false)}
            onCancel={() => setIsContactModalOpen(false)}
          />
        </Modal>
      )}
      {isEquipoModalOpen && (
        <Modal 
          title="Registrar Equipo" 
          onClose={() => setIsEquipoModalOpen(false)}
        >
          <EquipoForm 
            defaultCompanyId={id}
            onSuccess={() => setIsEquipoModalOpen(false)}
            onCancel={() => setIsEquipoModalOpen(false)}
          />
        </Modal>
      )}
      {isDocumentoModalOpen && (
        <Modal 
          title="Subir Documento" 
          onClose={() => setIsDocumentoModalOpen(false)}
        >
          <DocumentoUploader 
            entidadTipo="EMPRESA" 
            entidadId={id} 
            onClose={() => setIsDocumentoModalOpen(false)} 
            onUploadSuccess={() => setIsDocumentoModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
function CompanyFacturacionSection({ companyId }) {
  const navigate = useNavigate();
  const { data: facturas, isLoading: isFacturasLoading } = useQuery({
    queryKey: ['company-facturas', companyId],
    queryFn: () => facturacionApi.getFacturas({ empresa_id: companyId })
  });

  const { data: otsPendientes, isLoading: isOtsLoading } = useQuery({
    queryKey: ['company-ots-pendientes', companyId],
    queryFn: () => facturacionApi.getOtsPendientes({ empresa_id: companyId })
  });

  if (isFacturasLoading || isOtsLoading) return <div className="spinner" />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
          <p className="text-xs font-bold uppercase text-orange-500 mb-1">OTs Pendientes</p>
          <p className="text-2xl font-black">{otsPendientes?.data?.length || 0}</p>
          <button 
            onClick={() => navigate(`/facturacion/pendientes?empresa_id=${companyId}`)}
            className="text-xs font-bold mt-2 text-orange-600 hover:underline flex items-center gap-1"
          >
            Ir a facturar <Plus size={12} />
          </button>
        </div>
        <div className="p-4 bg-accent/10 rounded-2xl border border-accent/20">
          <p className="text-xs font-bold uppercase text-accent mb-1">Total Facturado</p>
          <p className="text-2xl font-black">
            {formatCurrency(facturas?.data?.reduce((acc, curr) => acc + (curr.estado === 'FACTURADA' ? parseFloat(curr.total) : 0), 0) || 0)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold border-b border-color pb-2">Historial de Facturas</h3>
        {facturas?.data?.length === 0 ? (
          <p className="text-center py-8 text-muted italic">No hay facturas registradas.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {facturas.data.map(f => (
                  <tr key={f.id} className="cursor-pointer hover:bg-subtle/30" onClick={() => navigate(`/facturacion/facturas/${f.id}`)}>
                    <td className="font-bold">{f.consecutivo_interno}</td>
                    <td>{new Date(f.fecha_prefactura).toLocaleDateString()}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${f.estado === 'FACTURADA' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="text-right font-bold">{formatCurrency(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
