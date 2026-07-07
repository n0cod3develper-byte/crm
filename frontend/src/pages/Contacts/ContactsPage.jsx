import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, Mail, Phone, Building2, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { ContactForm } from '../../components/Contacts/ContactForm';
import api from '../../lib/api';

function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
}

const TIPOS = [
  { value: 'todos',    label: 'Todos' },
  { value: 'empresa',  label: 'Empresa' },
  { value: 'proveedor', label: 'Proveedor' },
];

export function ContactsPage() {
  const [search, setSearch] = React.useState('');
  const [tipo, setTipo] = React.useState('todos');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, tipo],
    queryFn: async () => {
      const params = { search, limit: 50 };
      // No filtramos por ID aquí; filtramos en cliente por tipo para mantener la misma API
      const { data } = await api.get('/contacts', { params });
      return data;
    },
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      toast.success('Contacto eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al eliminar (¿Eres admin?)');
      setDeletingId(null);
    },
  });

  const allContacts = data?.data || [];

  // Filtro de tipo en cliente
  const contacts = allContacts.filter(c => {
    if (tipo === 'empresa')   return !!c.company_id && !c.proveedor_id;
    if (tipo === 'proveedor') return !!c.proveedor_id;
    return true;
  });

  const handleCreate = () => { setEditingContact(null); setIsModalOpen(true); };
  const handleEdit = (c) => { setEditingContact(c); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingContact(null); };

  return (
    <div className="app-layout">

      <Topbar
        title="Contactos"
        subtitle={`${contacts.length} contacto${contacts.length !== 1 ? 's' : ''} registrado${contacts.length !== 1 ? 's' : ''}`}
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} />
            Nuevo contacto
          </button>
        }
      />

      <main className="main-content">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Buscador */}
          <div style={{ position: 'relative', flex: '1', minWidth: 240, maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por nombre, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro de tipo */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {TIPOS.map(t => (
              <button
                key={t.value}
                className={`btn btn--sm ${tipo === t.value ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setTipo(t.value)}
              >
                {t.value === 'proveedor' && <Truck size={13} style={{ marginRight: '0.25rem' }} />}
                {t.value === 'empresa'   && <Building2 size={13} style={{ marginRight: '0.25rem' }} />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin contactos aún</h2>
            <p className="empty-state__desc">
              {tipo === 'proveedor'
                ? 'No hay contactos vinculados a proveedores.'
                : tipo === 'empresa'
                ? 'No hay contactos vinculados a empresas.'
                : 'Agrega personas de contacto y vincúlalas a sus empresas o proveedores.'}
            </p>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} />
              Agregar contacto
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {contacts.map(contact => (
              <div key={contact.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Avatar + Nombre */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: contact.proveedor_id
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, var(--clr-primary-500), #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 'var(--text-sm)',
                    }}>
                      {getInitials(contact.first_name, contact.last_name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {contact.first_name} {contact.last_name || ''}
                      </div>
                      {contact.position && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{contact.position}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                    {contact.is_primary && (
                      <span className="badge badge--primary" style={{ fontSize: '10px' }}>Principal</span>
                    )}
                    {contact.proveedor_id && (
                      <span className="badge badge--warning" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Truck size={10} /> Proveedor
                      </span>
                    )}
                  </div>
                </div>

                {/* Datos de contacto */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                      <Mail size={13} style={{ flexShrink: 0 }} />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                      <Phone size={13} style={{ flexShrink: 0 }} />
                      {contact.phone}
                    </a>
                  )}
                  {contact.proveedor_name ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      <Truck size={13} style={{ flexShrink: 0 }} />
                      {contact.proveedor_name}
                    </div>
                  ) : contact.company_name ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      <Building2 size={13} style={{ flexShrink: 0 }} />
                      {contact.company_name}
                    </div>
                  ) : null}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    className="btn btn--secondary btn--sm"
                    style={{ flex: 1 }}
                    onClick={() => handleEdit(contact)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ color: 'var(--clr-danger)' }}
                    onClick={() => setDeletingId(contact.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <Modal
          title={editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
          onClose={handleClose}
        >
          <ContactForm
            contact={editingContact}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        </Modal>
      )}

      {/* Modal Confirmar Eliminar */}
      {deletingId && (
        <Modal
          title="Eliminar Contacto"
          onClose={() => setDeletingId(null)}
          maxWidth="400px"
        >
          <p style={{ color: 'var(--text-secondary)' }}>
            ¿Estás seguro? El contacto será eliminado del sistema (soft delete — los datos históricos quedan intactos).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="btn btn--secondary" onClick={() => setDeletingId(null)}>Cancelar</button>
            <button
              className="btn btn--danger"
              onClick={() => deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
