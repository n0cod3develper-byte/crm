import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, Search, Send, CheckCircle, XCircle, FilePlus, Download, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Modal } from '../../components/common/Modal';
import { ContactForm } from '../../components/Contacts/ContactForm';
import api from '../../lib/api';

const IVA_RATE = 0.19;

const EMPTY = {
  company_id: '', contact_id: '', fecha: new Date().toISOString().slice(0, 10),
  valido_hasta: '',
  asunto: '', direccion_invitacion: '', ciudad_envio: '',
  descripcion: '', estado: 'BORRADOR',
};

const EMPTY_ITEM = { catalogo_servicio_id: '', servicio_nombre: '', descripcion: '', cantidad: 1, valor_unitario: 0, aplica_iva: false };

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

export function QuoteServicioFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [form, setForm] = useState({ ...EMPTY });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [companySearch, setCompanySearch] = useState('');
  const [servicioSearch, setServicioSearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({ address: '', notes: '' });

  // ─── Cargar cotización existente ──────────────────────────
  const { data: existingQuote } = useQuery({
    queryKey: ['quote-servicio', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes-servicios/${id}`);
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (existingQuote) {
      setForm({
        company_id: existingQuote.company_id || '',
        contact_id: existingQuote.contact_id || '',
        fecha: existingQuote.fecha ? existingQuote.fecha.slice(0, 10) : '',
        valido_hasta: existingQuote.valido_hasta ? existingQuote.valido_hasta.slice(0, 10) : '',
        asunto: existingQuote.asunto || '',
        direccion_invitacion: existingQuote.direccion_invitacion || '',
        ciudad_envio: existingQuote.ciudad_envio || '',
        descripcion: existingQuote.descripcion || '',
        estado: existingQuote.estado || 'BORRADOR',
      });
      if (existingQuote.items && existingQuote.items.length > 0) {
        setItems(existingQuote.items.map(it => ({
          catalogo_servicio_id: it.catalogo_servicio_id || '',
          servicio_nombre: it.servicio_nombre || '',
          descripcion: it.descripcion || '',
          cantidad: parseFloat(it.cantidad),
          valor_unitario: parseFloat(it.valor_unitario),
          aplica_iva: it.aplica_iva,
        })));
      }
    }
  }, [existingQuote]);

  // ─── Buscadores ──────────────────────────────────────────
  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', { params: { search: searchTerm || undefined, limit: 10 } });
    return data.data || data;
  }, []);

  const { data: contactsData, refetch: refetchContacts } = useQuery({
    queryKey: ['contacts-for-company', form.company_id],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { companyId: form.company_id, limit: 50 } });
      return data.data || data;
    },
    enabled: !!form.company_id,
  });

  const { data: serviceAddressesData = [], refetch: refetchAddresses } = useQuery({
    queryKey: ['company-service-addresses', form.company_id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${form.company_id}/service-addresses`);
      return data.data || data;
    },
    enabled: !!form.company_id,
  });

  const { data: catalogoItems = [] } = useQuery({
    queryKey: ['catalogoServicios'],
    queryFn: async () => {
      const { data } = await api.get('/catalogo-servicios', { params: { limit: 1000 } });
      return data.data || data;
    }
  });

  // ─── Cálculos ────────────────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    items.forEach(item => {
      const itemSub = (item.cantidad || 0) * (item.valor_unitario || 0);
      subtotal += itemSub;
      if (item.aplica_iva) iva += itemSub * IVA_RATE;
    });
    return { subtotal, iva, total: subtotal + iva };
  }, [items]);

  // ─── Mutaciones ──────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (isEditing) {
        return api.put(`/quotes-servicios/${id}`, payload);
      }
      return api.post('/quotes-servicios', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Cotización actualizada' : 'Cotización creada');
      queryClient.invalidateQueries({ queryKey: ['quotes-servicios'] });
      navigate('/quotes/servicios');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ qId, status }) => api.patch(`/quotes-servicios/${qId}/status`, { status }),
    onSuccess: (_, vars) => {
      toast.success(`Estado cambiado a ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['quotes-servicios'] });
      queryClient.invalidateQueries({ queryKey: ['quote-servicio', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  // ─── Handlers ────────────────────────────────────────────
  const handleViewPDF = async () => {
    try {
      const res = await api.get(`/quotes-servicios/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Error al abrir el PDF');
    }
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    if (!newAddressForm.address.trim()) return;
    try {
      const { data } = await api.post(`/companies/${form.company_id}/service-addresses`, newAddressForm);
      setIsAddressModalOpen(false);
      setNewAddressForm({ address: '', notes: '' });
      refetchAddresses();
      setForm(prev => ({ ...prev, direccion_invitacion: data.data?.address || data.address }));
      toast.success('Dirección creada');
    } catch (err) {
      toast.error('Error al crear dirección');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/quotes-servicios/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cotizacion_${existingQuote.consecutivo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      if (form.estado === 'BORRADOR') {
        statusMutation.mutate({ qId: id, status: 'PENDIENTE' });
      }
    } catch (error) {
      toast.error('Error al descargar el PDF');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.company_id) { toast.error('Selecciona una empresa'); return; }
    if (items.length === 0 || (!items[0].catalogo_servicio_id && !items[0].descripcion)) { toast.error('Agrega al menos un ítem'); return; }

    saveMutation.mutate({
      ...form,
      subtotal: totals.subtotal,
      iva_valor: totals.iva,
      total: totals.total,
      items: items.map(it => ({
        ...it,
        subtotal: (it.cantidad || 0) * (it.valor_unitario || 0),
        iva_valor: it.aplica_iva ? (it.cantidad || 0) * (it.valor_unitario || 0) * IVA_RATE : 0,
      })),
    });
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const field = (label, name, type = 'text', opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          className="input"
          rows={3}
          value={form[name]}
          onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          placeholder={opts.placeholder || ''}
        />
      ) : (
        <input
          className="input"
          type={type}
          value={form[name]}
          onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          placeholder={opts.placeholder || ''}
        />
      )}
    </div>
  );

  // Style for section headers
  const sectionStyle = {
    fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '1.5rem 0 0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem'
  };

  return (
    <div className="app-layout">
      <Topbar
        title={isEditing ? `Cotización ${existingQuote?.consecutivo || ''}` : 'Nueva Cotización de Servicio'}
        subtitle={isEditing ? `Estado: ${form.estado}` : 'Crear propuesta comercial de servicio'}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => navigate('/quotes/servicios')}>
              <ArrowLeft size={16} /> Volver
            </button>
            {isEditing && (
              <button className="btn btn--secondary" onClick={handleDownloadPDF} title="Descargar PDF y marcar como PENDIENTE">
                <Download size={16} /> Descargar
              </button>
            )}
            {isEditing && form.estado === 'PENDIENTE' && (
              <>
                <button className="btn btn--primary" style={{ background: '#16a34a' }}
                  onClick={() => statusMutation.mutate({ qId: id, status: 'ACEPTADA' })}>
                  <CheckCircle size={16} /> Aceptar
                </button>
                <button className="btn btn--secondary" style={{ color: '#dc2626', borderColor: '#dc2626' }}
                  onClick={() => statusMutation.mutate({ qId: id, status: 'RECHAZADA' })}>
                  <XCircle size={16} /> Rechazar
                </button>
              </>
            )}
            {isEditing && form.estado === 'ACEPTADA' && (
              <button className="btn btn--primary" style={{ background: '#0284c7' }}
                onClick={() => navigate('/servicios/nueva', { state: { prefillFromQuote: existingQuote } })}>
                <FilePlus size={16} /> Convertir a Remisión
              </button>
            )}
          </div>
        }
      />

      <main className="main-content">
        <form onSubmit={handleSubmit}>
          <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>

            {/* ─── Empresa ─────────────────────── */}
            <div style={sectionStyle}>Datos del Cliente</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {/* Buscador empresa */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                  Empresa *
                </label>
                <SearchableSelect
                  fetchFn={searchCompanies}
                  value={form.company_id}
                  onChange={(val, item) => setForm(p => ({
                    ...p,
                    company_id: val || '',
                    contact_id: '',
                    direccion_invitacion: (item && item.address) ? item.address : p.direccion_invitacion,
                    ciudad_envio: (item && item.city) ? item.city : p.ciudad_envio
                  }))}
                  placeholder="Buscar empresa..."
                  getOptionLabel={c => c.name}
                  renderOption={c => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.nit && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NIT: {c.nit}</div>}
                    </div>
                  )}
                  initialItem={existingQuote && existingQuote.company_name ? { id: existingQuote.company_id, name: existingQuote.company_name, nit: existingQuote.company_nit } : null}
                />
              </div>

              {/* Contacto */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Contacto</span>
                  {form.company_id && (
                    <button type="button" onClick={() => setIsContactModalOpen(true)} className="btn btn--ghost btn--sm" style={{ padding: '0 4px', height: 'auto', color: 'var(--primary)' }} title="Nuevo contacto">
                      <Plus size={14} /> Nuevo
                    </button>
                  )}
                </label>
                <select className="input" value={form.contact_id}
                  onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}
                  disabled={!form.company_id}
                >
                  <option value="">Seleccionar contacto</option>
                  {(contactsData || []).map(ct => (
                    <option key={ct.id} value={ct.id}>{ct.first_name} {ct.last_name || ''}</option>
                  ))}
                </select>
              </div>

              {field('Fecha', 'fecha', 'date')}
              {field('Válida hasta', 'valido_hasta', 'date')}
            </div>

            {/* ─── Detalles ─────────────────────── */}
            <div style={sectionStyle}>Detalles de la Cotización</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {field('Asunto', 'asunto', 'text', { placeholder: 'Propuesta de servicio...' })}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Dirección de Envío</span>
                  {form.company_id && (
                    <button type="button" onClick={() => setIsAddressModalOpen(true)} className="btn btn--ghost btn--sm" style={{ padding: '0 4px', height: 'auto', color: 'var(--primary)' }} title="Nueva dirección">
                      <Plus size={14} /> Nueva
                    </button>
                  )}
                </label>
                <select className="input" value={form.direccion_invitacion}
                  onChange={e => setForm(p => ({ ...p, direccion_invitacion: e.target.value }))}
                  disabled={!form.company_id}
                >
                  <option value="">Seleccionar dirección...</option>
                  {serviceAddressesData.map(a => (
                    <option key={a.id} value={a.address}>{a.address} {a.notes ? `- ${a.notes}` : ''}</option>
                  ))}
                  {form.direccion_invitacion && !serviceAddressesData.find(a => a.address === form.direccion_invitacion) && (
                    <option value={form.direccion_invitacion}>{form.direccion_invitacion}</option>
                  )}
                </select>
              </div>
              {field('Ciudad de Envío', 'ciudad_envio', 'text', { placeholder: 'Ciudad...' })}
            </div>

            {/* Descripción */}
            <div style={{ marginTop: 16 }}>
              {field('Descripción', 'descripcion', 'textarea', { placeholder: 'Descripción detallada del servicio...' })}
            </div>

            {/* ─── Tabla de Ítems ──────────────── */}
            <div style={sectionStyle}>Ítems de la Cotización</div>
            <div style={{ marginBottom: 16, overflow: 'visible' }}>
              <table className="table" style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ width: 250 }}>Tipo Servicio</th>
                    <th>Descripción</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Cantidad</th>
                    <th style={{ width: 140, textAlign: 'right' }}>V. Unitario</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Subtotal</th>
                    <th style={{ width: 70, textAlign: 'center' }}>IVA</th>
                    <th style={{ width: 130, textAlign: 'right' }}>IVA Valor</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const itemSub = (item.cantidad || 0) * (item.valor_unitario || 0);
                    const itemIva = item.aplica_iva ? itemSub * IVA_RATE : 0;
                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ overflow: 'visible', position: 'relative' }}>
                            <SearchableSelect
                              value={item.catalogo_servicio_id || ''}
                              onChange={(val, s) => {
                                updateItem(idx, 'catalogo_servicio_id', val || '');
                                if (s) {
                                  updateItem(idx, 'servicio_nombre', s.nombre);
                                  updateItem(idx, 'valor_unitario', parseFloat(s.precio_venta || s.precio_servicio || s.precio_base || 0));
                                }
                              }}
                              fetchFn={async (term) => {
                                const lower = term.toLowerCase();
                                return catalogoItems.filter(s => s.nombre?.toLowerCase().includes(lower) || s.codigo?.toLowerCase().includes(lower));
                              }}
                              placeholder="Buscar en catálogo..."
                              getOptionLabel={s => `[${s.codigo}] ${s.nombre}`}
                              renderOption={(s, { isHighlighted }) => (
                                <div>
                                  <div style={{ fontWeight: isHighlighted ? 700 : 500 }}>[{s.codigo}] {s.nombre}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatCurrency(s.precio_venta || s.precio_servicio || s.precio_base)}</div>
                                </div>
                              )}
                              initialItem={catalogoItems.find(s => String(s.id) === String(item.catalogo_servicio_id)) || (item.servicio_nombre ? { id: item.catalogo_servicio_id, codigo: item.servicio_codigo || 'N/A', nombre: item.servicio_nombre } : null)}
                              minSearchLength={0}
                            />
                        </td>
                        <td>
                          <input className="input" placeholder="Descripción detallada del ítem" style={{ width: '100%' }}
                            value={item.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)} />
                        </td>
                        <td>
                          <input className="input" type="number" min="1" style={{ textAlign: 'center', width: '100%' }}
                            value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td>
                          <input className="input" type="number" min="0" style={{ textAlign: 'right', width: '100%' }}
                            value={item.valor_unitario} onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(itemSub)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={item.aplica_iva}
                            onChange={e => updateItem(idx, 'aplica_iva', e.target.checked)}
                            style={{ width: 18, height: 18, cursor: 'pointer' }} />
                        </td>
                        <td style={{ textAlign: 'right', color: itemIva > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {formatCurrency(itemIva)}
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeItem(idx)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button type="button" className="btn btn--secondary" onClick={addItem} style={{ marginBottom: 24 }}>
              <Plus size={16} /> Agregar Ítem
            </button>

            {/* ─── Totales ──────────────────────── */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', marginBottom: 24
            }}>
              <div style={{
                width: 320, background: 'var(--background)', borderRadius: 8,
                border: '1px solid var(--border)', padding: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
                  <span>IVA (19%):</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(totals.iva)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  fontSize: '1.1rem', fontWeight: 700, borderTop: '2px solid var(--border)', marginTop: 4
                }}>
                  <span>TOTAL:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* ─── Botón Guardar ─────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn--secondary" onClick={() => navigate('/quotes/servicios')}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={saveMutation.isPending}>
                <Save size={16} /> {saveMutation.isPending ? 'Guardando…' : isEditing ? 'Actualizar' : 'Guardar Cotización'}
              </button>
            </div>

          </div>
        </form>
      </main>

      {/* MODALES */}
      {isContactModalOpen && (
        <Modal title="Crear Contacto Rápido" onClose={() => setIsContactModalOpen(false)}>
          <div style={{ padding: '0 1rem 1rem' }}>
            <ContactForm
              companyId={form.company_id}
              onSuccess={() => {
                setIsContactModalOpen(false);
                refetchContacts();
              }}
              onCancel={() => setIsContactModalOpen(false)}
            />
          </div>
        </Modal>
      )}

      {isAddressModalOpen && (
        <Modal title="Agregar Dirección de Envío" onClose={() => setIsAddressModalOpen(false)}>
          <form onSubmit={handleCreateAddress} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem 1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Dirección *</label>
              <input
                className="input"
                required
                value={newAddressForm.address}
                onChange={e => setNewAddressForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Ej. Calle 123 #45-67"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Notas / Sede (Opcional)</label>
              <input
                className="input"
                value={newAddressForm.notes}
                onChange={e => setNewAddressForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Ej. Sede principal, bodega 2..."
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsAddressModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={!newAddressForm.address.trim()}>Guardar Dirección</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
