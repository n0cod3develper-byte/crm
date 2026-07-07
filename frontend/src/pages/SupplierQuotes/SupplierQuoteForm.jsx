import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, Package, User, Phone
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import api from '../../lib/api';

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

const FORMAS_PAGO = [
  { value: 'CONTADO',         label: 'Contado' },
  { value: '15_DIAS',         label: '15 días' },
  { value: '30_DIAS',         label: '30 días' },
  { value: '45_DIAS',         label: '45 días' },
  { value: '60_DIAS',         label: '60 días' },
  { value: '90_DIAS',         label: '90 días' },
  { value: 'CREDITO_ESPECIAL', label: 'Crédito especial' },
];

const ESTADOS_COMERCIALES = [
  { value: 'EN_ESPERA', label: 'En espera' },
  { value: 'ACEPTADO',  label: 'Aceptado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
];

const emptyItem = () => ({
  key: Date.now() + Math.random(),
  item: '',
  codigo: '',
  descripcion_manual: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento: 0,
});

export function SupplierQuoteForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ─── Cabecera ───────────────────────────────────────────────
  const [proveedorId, setProveedorId] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [contactId, setContactId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [numeroCotizacion, setNumeroCotizacion] = useState('');

  // ─── Detalle ────────────────────────────────────────────────
  const [items, setItems] = useState([emptyItem()]);

  // ─── Info Comercial ─────────────────────────────────────────
  const [validezOferta, setValidezOferta] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [estadoComercial, setEstadoComercial] = useState('EN_ESPERA');
  const [ivaGlobal, setIvaGlobal] = useState(19);

  const [saving, setSaving] = useState(false);

  // ─── Cargar datos existentes si es edición ──────────────────
  const { data: existingQuote } = useQuery({
    queryKey: ['supplier-quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/supplier-quotes/${id}`);
      return data.data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingQuote) {
      setProveedorId(existingQuote.proveedor_id || '');
      setContactId(existingQuote.contact_id || '');
      setTelefonoContacto(existingQuote.telefono_contacto || '');
      setNumeroCotizacion(existingQuote.numero_cotizacion || '');
      setValidezOferta(existingQuote.validez_oferta ?? '');
      setFormaPago(existingQuote.forma_pago || '');
      setEstadoComercial(existingQuote.estado_comercial || 'EN_ESPERA');
      setIvaGlobal(existingQuote.iva != null ? existingQuote.iva : 19);

      if (existingQuote.items?.length > 0) {
        setItems(existingQuote.items.map((it, i) => ({
          key: i,
          item: it.descripcion_manual || it.inventario_nombre || '',
          codigo: it.codigo || '',
          descripcion_manual: it.descripcion_manual || '',
          cantidad: it.cantidad || 1,
          precio_unitario: it.precio_unitario || 0,
          descuento: it.descuento || 0,
        })));
      }

      // Cargar proveedor seleccionado
      if (existingQuote.proveedor_id) {
        api.get(`/proveedores/${existingQuote.proveedor_id}`)
          .then(r => setSelectedProveedor(r.data.data))
          .catch(() => {});
      }
      // Cargar contacto seleccionado
      if (existingQuote.contact_id) {
        api.get(`/contacts/${existingQuote.contact_id}`)
          .then(r => setSelectedContact(r.data.data))
          .catch(() => {});
      }
    }
  }, [existingQuote]);

  // ─── Auto-completar teléfono cuando cambia el contacto ──────
  useEffect(() => {
    if (selectedContact?.phone) {
      setTelefonoContacto(selectedContact.phone);
    }
  }, [selectedContact]);

  // ─── Búsqueda de proveedores ─────────────────────────────────
  const searchProveedores = useCallback(async (term) => {
    const { data } = await api.get('/proveedores', { params: { search: term || undefined, limit: 20 } });
    return data.data || [];
  }, []);

  // ─── Contactos del proveedor seleccionado ────────────────────
  const { data: contactosProveedor } = useQuery({
    queryKey: ['proveedor-contacts', proveedorId],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { proveedorId, limit: 50 } });
      return data.data || [];
    },
    enabled: !!proveedorId,
  });

  // Al cambiar proveedor, limpiar contacto
  const handleProveedorChange = (val, item) => {
    setProveedorId(val);
    setSelectedProveedor(item);
    setContactId('');
    setSelectedContact(null);
    setTelefonoContacto('');
  };

  const handleContactChange = (id) => {
    setContactId(id);
    const c = (contactosProveedor || []).find(x => x.id === id);
    setSelectedContact(c || null);
    if (c?.phone) setTelefonoContacto(c.phone);
    else setTelefonoContacto('');
  };

  // ─── Ítems ───────────────────────────────────────────────────
  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Cálculos ────────────────────────────────────────────────
  const itemTotal = (it) => Math.max(0, (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0) - (parseFloat(it.descuento) || 0));
  const subtotal = items.reduce((sum, it) => sum + itemTotal(it), 0);
  const ivaAmount = subtotal * ((parseFloat(ivaGlobal) || 0) / 100);
  const total = subtotal + ivaAmount;

  // ─── Guardar ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!proveedorId) { toast.error('Selecciona un proveedor'); return; }
    if (items.length === 0) { toast.error('Agrega al menos un ítem'); return; }

    const invalidItem = items.find(it => !it.descripcion_manual && !it.item);
    if (invalidItem) { toast.error('Completa la descripción de todos los ítems'); return; }

    const negativo = items.find(it => (parseFloat(it.cantidad) || 0) <= 0 || (parseFloat(it.precio_unitario) || 0) < 0);
    if (negativo) { toast.error('Cantidad y valor unitario deben ser positivos'); return; }

    setSaving(true);

    const payload = {
      proveedor_id: proveedorId,
      contact_id: contactId || null,
      telefono_contacto: telefonoContacto || null,
      numero_cotizacion: numeroCotizacion || null,
      estado: isEditing ? existingQuote?.estado : 'CREADO',
      subtotal,
      total,
      validez_oferta: validezOferta ? parseInt(validezOferta) : null,
      forma_pago: formaPago || null,
      estado_comercial: estadoComercial,
      iva: parseFloat(ivaGlobal) != null ? parseFloat(ivaGlobal) : 19,
      items: items.map(it => ({
        descripcion_manual: it.descripcion_manual || it.item || null,
        codigo: it.codigo || null,
        cantidad: parseFloat(it.cantidad) || 1,
        precio_unitario: parseFloat(it.precio_unitario) || 0,
        descuento: parseFloat(it.descuento) || 0,
        margen_utilidad: 0,
      })),
    };

    try {
      if (isEditing) {
        await api.patch(`/supplier-quotes/${id}`, payload);
        toast.success('Cotización actualizada');
      } else {
        await api.post('/supplier-quotes', payload);
        toast.success('Cotización creada');
      }
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
      navigate('/supplier-quotes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-layout">
      <Topbar
        title={isEditing ? 'Editar Cotización a Proveedor' : 'Nueva Cotización a Proveedor'}
        subtitle={isEditing ? `Editando ${existingQuote?.consecutivo || ''}` : 'Completa los datos de la cotización'}
        rightContent={
          <button className="btn btn--ghost" onClick={() => navigate('/supplier-quotes')}>
            <ArrowLeft size={16} /> Volver al listado
          </button>
        }
      />

      <main className="main-content">
        <form onSubmit={handleSubmit} style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem' }}>

          {/* ── CABECERA ──────────────────────────────────────── */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Cabecera
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {/* Proveedor */}
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Proveedor *</label>
                <SearchableSelect
                  fetchFn={searchProveedores}
                  value={proveedorId}
                  onChange={handleProveedorChange}
                  initialItem={selectedProveedor}
                  getOptionLabel={(item) => `${item.razon_social} — ${item.numero_documento}`}
                  placeholder="Buscar por nombre o NIT..."
                  name="proveedor_id"
                  noOptionsMessage="No se encontraron proveedores"
                  minSearchLength={0}
                />
              </div>

              {/* Número Cotización Proveedor */}
              <div className="input-group">
                <label className="input-label">Nº Cotización Prov.</label>
                <input
                  className="input"
                  placeholder="Ej: COT-1234"
                  value={numeroCotizacion}
                  onChange={e => setNumeroCotizacion(e.target.value)}
                />
              </div>

              {/* Contacto */}
              <div className="input-group">
                <label className="input-label">Contacto</label>
                {proveedorId ? (
                  <select
                    className="input"
                    value={contactId}
                    onChange={e => handleContactChange(e.target.value)}
                    disabled={!proveedorId}
                  >
                    <option value="">— Sin contacto —</option>
                    {(contactosProveedor || []).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name || ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    disabled
                    placeholder="Selecciona primero un proveedor"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                  />
                )}
              </div>

              {/* Teléfono auto-llenado */}
              <div className="input-group">
                <label className="input-label">Teléfono</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
                    value={telefonoContacto}
                    onChange={e => setTelefonoContacto(e.target.value)}
                    placeholder="Auto-completado del contacto"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── DETALLE ──────────────────────────────────────── */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Detalle de ítems
              </h3>
              <button type="button" className="btn btn--primary btn--sm" onClick={addItem}>
                <Plus size={14} /> Agregar ítem
              </button>
            </div>

            {items.length === 0 ? (
              <div style={{
                padding: '2rem', textAlign: 'center', borderRadius: '8px',
                border: '2px dashed var(--border-color)', color: 'var(--text-muted)',
              }}>
                <Package size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                <p>No hay ítems. Haz clic en "Agregar ítem" para comenzar.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '25%' }}>Ítem / Descripción *</th>
                      <th style={{ width: '12%' }}>Código</th>
                      <th style={{ width: '8%' }}>Cant. *</th>
                      <th style={{ width: '14%' }}>V. Unitario *</th>
                      <th style={{ width: '12%' }}>Descuento</th>
                      <th style={{ width: '14%' }}>Total</th>
                      <th style={{ width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, index) => (
                      <tr key={it.key}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
                        <td>
                          <input
                            className="input"
                            type="text"
                            placeholder="Nombre del producto o servicio"
                            value={it.descripcion_manual || it.item}
                            onChange={e => updateItem(index, 'descripcion_manual', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            type="text"
                            placeholder="Cód."
                            value={it.codigo}
                            onChange={e => updateItem(index, 'codigo', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={it.cantidad}
                            onChange={e => updateItem(index, 'cantidad', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.precio_unitario}
                            onChange={e => updateItem(index, 'precio_unitario', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.descuento}
                            onChange={e => updateItem(index, 'descuento', e.target.value)}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatCurrency(itemTotal(it))}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ padding: '0.375rem', color: 'var(--clr-danger)' }}
                            onClick={() => removeItem(index)}
                            title="Eliminar ítem"
                            disabled={items.length === 1}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        SUBTOTAL
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)', padding: '0.75rem 0.5rem' }}>
                        {formatCurrency(subtotal)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <span>IVA</span>
                          <input 
                            className="input" 
                            type="number" 
                            min="0" 
                            max="100" 
                            style={{ width: '70px', padding: '0.25rem 0.5rem', textAlign: 'center' }} 
                            value={ivaGlobal} 
                            onChange={e => setIvaGlobal(e.target.value)} 
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)', padding: '0.75rem 0.5rem' }}>
                        {formatCurrency(ivaAmount)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        TOTAL COTIZACIÓN
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--clr-success, #16a34a)', padding: '0.75rem 0.5rem' }}>
                        {formatCurrency(total)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── INFO COMERCIAL ───────────────────────────────── */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Información Comercial
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {/* Validez de oferta */}
              <div className="input-group">
                <label className="input-label">Validez de oferta (días)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="Ej: 30"
                  value={validezOferta}
                  onChange={e => setValidezOferta(e.target.value)}
                />
              </div>

              {/* Forma de pago */}
              <div className="input-group">
                <label className="input-label">Forma de pago</label>
                <select className="input" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {FORMAS_PAGO.map(fp => (
                    <option key={fp.value} value={fp.value}>{fp.label}</option>
                  ))}
                </select>
              </div>

              {/* Estado comercial */}
              <div className="input-group">
                <label className="input-label">Estado</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {ESTADOS_COMERCIALES.map(es => (
                    <button
                      key={es.value}
                      type="button"
                      onClick={() => setEstadoComercial(es.value)}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.25rem',
                        borderRadius: '6px',
                        border: '2px solid',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        borderColor: estadoComercial === es.value
                          ? (es.value === 'ACEPTADO' ? '#16a34a' : es.value === 'RECHAZADO' ? '#dc2626' : 'var(--clr-primary-500)')
                          : 'var(--border-color)',
                        background: estadoComercial === es.value
                          ? (es.value === 'ACEPTADO' ? '#dcfce7' : es.value === 'RECHAZADO' ? '#fee2e2' : 'var(--clr-primary-50, #eff6ff)')
                          : 'transparent',
                        color: estadoComercial === es.value
                          ? (es.value === 'ACEPTADO' ? '#166534' : es.value === 'RECHAZADO' ? '#991b1b' : 'var(--clr-primary-700, #1d4ed8)')
                          : 'var(--text-secondary)',
                      }}
                    >
                      {es.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Botones ──────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '2rem' }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/supplier-quotes')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando…' : isEditing ? 'Actualizar' : 'Crear Cotización'}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
