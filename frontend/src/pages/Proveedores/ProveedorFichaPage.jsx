import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Star, Phone, Mail, 
  MapPin, CreditCard, History, FileCheck,
  Building2, Globe, ShieldCheck, MoreVertical,
  Briefcase, CheckCircle2, AlertTriangle, Plus,
  Info, User, FileText
} from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { DocumentosList } from '../../components/documentos/DocumentosList';
import { DocumentoUploader } from '../../components/documentos/DocumentoUploader';
import api from '../../lib/api';

export function ProveedorFichaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('info');
  const [isDocumentoModalOpen, setIsDocumentoModalOpen] = React.useState(false);
  const [isSupplierQuoteModalOpen, setIsSupplierQuoteModalOpen] = React.useState(false);
  const [selectedSupplierQuoteId, setSelectedSupplierQuoteId] = React.useState(null);

  const { data: proveedor, isLoading } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: async () => {
      const { data } = await api.get(`/proveedores/${id}`);
      return data.data || data;
    }
  });

  const { data: quotesData, isLoading: isQuotesLoading } = useQuery({
    queryKey: ['provider-quotes', id],
    queryFn: async () => {
      const { data } = await api.get('/supplier-quotes', { params: { providerId: id, limit: 100 } });
      return data.data;
    }
  });

  const { data: contactsData, isLoading: isContactsLoading } = useQuery({
    queryKey: ['provider-contacts', id],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { proveedorId: id, limit: 100 } });
      return data.data || [];
    }
  });

  if (isLoading) return <div className="app-layout"><div className="main-content flex justify-center items-center"><div className="spinner" /></div></div>;
  if (!proveedor) return <div className="app-layout"><div className="main-content">Proveedor no encontrado</div></div>;

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={16} fill={star <= (rating || 0) ? "#f59e0b" : "transparent"} color={star <= (rating || 0) ? "#f59e0b" : "var(--text-muted)"} />
      ))}
    </div>
  );

  return (
    <div className="app-layout">
            <Topbar 
        title={proveedor.razon_social} 
        subtitle="null"
        rightContent={<>
          <div className="flex items-center gap-3">
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/proveedores')}>
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-4">
               <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--clr-primary-500)', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>
                  {proveedor.razon_social.charAt(0)}
               </div>
               
                  <div className="flex items-center gap-3 text-sm text-muted">
                     <span>NIT: {proveedor.numero_documento}-{proveedor.digito_verificacion || '0'}</span>
                     <span>·</span>
                     <div className="flex items-center gap-1">
                       {renderStars(proveedor.calificacion_promedio || 0)}
                       <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: '0.25rem' }}>{(proveedor.calificacion_promedio || 0).toFixed(1)}</span>
                     </div>
                  </div>
               </div>
            </div>
          <div className="flex gap-2">
            <button className="btn btn--secondary" onClick={() => navigate(`/proveedores/${id}/editar`)}>
              <Edit size={16} /> Editar Perfil
            </button>
            <button className="btn btn--primary" onClick={() => navigate(`/compras/solicitudes/nueva?proveedorId=${id}`)}>
              <Plus size={16} /> Crear Solicitud
            </button>
          </div>
        </>} 
      />

      <main className="main-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
          
          <div className="flex flex-col gap-6">
            {/* Tabs Navigation */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
                {[
                  { id: 'info', label: 'Información General', icon: Info },
                  { id: 'contactos', label: 'Contactos', icon: User },
                  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
                  { id: 'compras', label: 'Historial de Compras', icon: History },
                  { id: 'documentos', label: 'Documentación', icon: FileCheck },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '1rem 1.5rem',
                      border: 'none',
                      background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: activeTab === tab.id ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                      borderBottom: activeTab === tab.id ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: '2rem' }}>
                {activeTab === 'info' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Contacto y Ubicación</h3>
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-3">
                           <Phone size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Teléfono</div>
                              <div style={{ fontWeight: 500 }}>{proveedor.telefono_principal}</div>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <Mail size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Email Principal</div>
                              <div style={{ fontWeight: 500 }}>{proveedor.email_principal}</div>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <MapPin size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Dirección</div>
                              <div style={{ fontWeight: 500 }}>{proveedor.direccion}, {proveedor.ciudad}</div>
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{proveedor.pais}</div>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <Briefcase size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>NIT</div>
                              <div style={{ fontWeight: 500 }}>{proveedor.numero_documento}-{proveedor.digito_verificacion || '0'}</div>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Condiciones Comerciales</h3>
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-3">
                           <CreditCard size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Términos de Pago</div>
                              <div style={{ fontWeight: 500 }}>{proveedor.condicion_pago.replace('_', ' ')}</div>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <ShieldCheck size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Régimen Tributario</div>
                              <div style={{ fontWeight: 500 }}>{proveedor.regimen_tributario.replace('_', ' ')}</div>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <Globe size={18} className="text-muted" />
                           <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Sitio Web</div>
                              <a href={proveedor.sitio_web} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: 'var(--clr-primary-500)' }}>{proveedor.sitio_web || 'No registrado'}</a>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'compras' && (
                  <div className="empty-state">
                    <History size={48} className="empty-state__icon" />
                    <h3 className="empty-state__title">Sin historial de compras</h3>
                    <p className="empty-state__desc">Aún no se han emitido órdenes de compra a este proveedor.</p>
                  </div>
                )}

                {activeTab === 'contactos' && (
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Contactos Vinculados</h3>
                      <button className="btn btn--primary btn--sm" onClick={() => navigate('/contacts')}>
                        <Plus size={14} /> Ir a Contactos
                      </button>
                    </div>

                    {isContactsLoading ? (
                      <div className="spinner" />
                    ) : contactsData?.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No hay contactos registrados para este proveedor.
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table style={{ background: 'transparent' }}>
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Cargo</th>
                              <th>Teléfono</th>
                              <th>Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contactsData.map(c => (
                              <tr key={c.id}>
                                <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)', cursor: 'pointer' }} onClick={() => navigate('/contacts')}>
                                  {c.first_name} {c.last_name || ''}
                                </td>
                                <td>{c.position || '—'}</td>
                                <td>{c.phone || c.whatsapp || '—'}</td>
                                <td>{c.email || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'cotizaciones' && (
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Cotizaciones Solicitadas</h3>
                      <button className="btn btn--primary btn--sm" onClick={() => navigate('/supplier-quotes')}>
                        <Plus size={14} /> Ir a Cotizaciones
                      </button>
                    </div>

                    {isQuotesLoading ? (
                      <div className="spinner" />
                    ) : quotesData?.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No hay cotizaciones registradas para este proveedor.
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table style={{ background: 'transparent' }}>
                          <thead>
                            <tr>
                              <th>Consecutivo</th>
                              <th>Fecha</th>
                              <th>Total</th>
                              <th>Estado</th>
                              <th>Estado Comercial</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotesData.map(q => (
                              <tr key={q.id}>
                                <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)', cursor: 'pointer' }} onClick={() => { setSelectedSupplierQuoteId(q.id); setIsSupplierQuoteModalOpen(true); }}>
                                  {q.consecutivo}
                                </td>
                                <td>{new Date(q.created_at).toLocaleDateString()}</td>
                                <td style={{ fontWeight: 600 }}>
                                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(q.total || 0)}
                                </td>
                                <td>
                                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-elevated)' }}>
                                    {q.estado}
                                  </span>
                                </td>
                                <td>
                                  {q.estado_comercial ? (
                                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-elevated)' }}>
                                      {q.estado_comercial}
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'documentos' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 style={{ fontWeight: 700 }}>Documentos del Proveedor</h3>
                      <button className="btn btn--primary btn--sm" onClick={() => setIsDocumentoModalOpen(true)}>
                        <Plus size={14} /> Subir documento
                      </button>
                    </div>
                    <DocumentosList entidadTipo="PROVEEDOR" entidadId={id} />
                  </div>
                )}
              </div>
            </div>

            {/* Notas internas */}
            <div className="card">
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem' }}>Notas Internas</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                {proveedor.notas_internas || 'No hay notas internas registradas para este proveedor.'}
              </p>
            </div>
          </div>

          {/* Sidebar / Stats */}
          <div className="flex flex-col gap-6">
            <div className="card" style={{ background: 'var(--clr-primary-500)', color: 'white' }}>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8, textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem' }}>Resumen de Cuenta</div>
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                 <div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>$0</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>Saldo Pendiente</div>
                 </div>
                 <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                 <div className="flex justify-between">
                    <span style={{ fontSize: 'var(--text-sm)' }}>Órdenes Totales</span>
                    <span style={{ fontWeight: 700 }}>0</span>
                 </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-sm mb-4">Contacto Directo</h3>
              <div className="flex items-center gap-3">
                 <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'grid', placeItems: 'center' }}>
                    <User size={20} className="text-muted" />
                 </div>
                 <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{proveedor.contacto_nombre || 'No definido'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{proveedor.contacto_cargo || 'Representante'}</div>
                 </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                 <button className="btn btn--secondary btn--sm w-full"><Phone size={14} /> Llamar</button>
                 <button className="btn btn--secondary btn--sm w-full"><Mail size={14} /> Enviar Correo</button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {isDocumentoModalOpen && (
        <Modal 
          title="Subir Documento" 
          onClose={() => setIsDocumentoModalOpen(false)}
        >
          <DocumentoUploader 
            entidadTipo="PROVEEDOR" 
            entidadId={id} 
            onClose={() => setIsDocumentoModalOpen(false)} 
            onUploadSuccess={() => setIsDocumentoModalOpen(false)}
          />
        </Modal>
      )}

      {isSupplierQuoteModalOpen && selectedSupplierQuoteId && (
        <Modal 
          title="Detalles de Cotización de Proveedor" 
          onClose={() => setIsSupplierQuoteModalOpen(false)}
          maxWidth="800px"
        >
          <SupplierQuoteDetailView quoteId={selectedSupplierQuoteId} onClose={() => setIsSupplierQuoteModalOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

function SupplierQuoteDetailView({ quoteId, onClose }) {
  const { data: quoteResponse, isLoading } = useQuery({
    queryKey: ['supplier-quote-detail', quoteId],
    queryFn: async () => {
      const { data } = await api.get(`/supplier-quotes/${quoteId}`);
      return data.data || data;
    }
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount || 0);
  };

  if (isLoading) return <div className="spinner" style={{ margin: 'auto' }} />;
  if (!quoteResponse) return <div>Cotización no encontrada.</div>;

  const quote = quoteResponse;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Consecutivo</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{quote.consecutivo}</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Estado</div>
          <div><span className="badge badge--primary">{quote.estado}</span></div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Fecha</div>
          <div style={{ fontWeight: 500 }}>{new Date(quote.created_at).toLocaleDateString()}</div>
        </div>
      </div>
      
      <div>
        <h4 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Ítems Solicitados</h4>
        <table style={{ background: 'transparent', margin: 0, fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr>
              <th>Descripción</th>
              <th style={{ textAlign: 'center' }}>Cant.</th>
              <th style={{ textAlign: 'right' }}>V. Unitario</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {quote.items?.map(item => {
              const qty = parseFloat(item.cantidad || item.quantity) || 0;
              const price = parseFloat(item.precio_unitario || item.unit_price) || 0;
              const subtotal = qty * price;
              return (
                <tr key={item.id}>
                  <td>{item.descripcion || item.description}</td>
                  <td style={{ textAlign: 'center' }}>{qty}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(price)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(subtotal)}</td>
                </tr>
              );
            })}
            {!quote.items?.length && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No hay ítems registrados</td>
              </tr>
            )}
          </tbody>
        </table>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <div style={{ minWidth: '200px' }}>
            <div className="flex justify-between" style={{ padding: '0.25rem 0', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between" style={{ padding: '0.25rem 0', color: 'var(--text-secondary)' }}>
              <span>Impuestos:</span>
              <span>{formatCurrency(quote.impuestos || quote.tax_amount)}</span>
            </div>
            <div className="flex justify-between" style={{ padding: '0.5rem 0', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.25rem' }}>
              <span>Total Sugerido:</span>
              <span style={{ color: 'var(--clr-primary-500)' }}>{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {quote.notas && (
        <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px' }}>
          <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: 'var(--text-sm)' }}>Notas</h4>
          <p style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{quote.notas}</p>
        </div>
      )}
      
      <div className="flex justify-end mt-4">
        <button className="btn btn--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
