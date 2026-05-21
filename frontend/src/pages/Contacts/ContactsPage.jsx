import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Mail, Phone, Building2, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { ContactForm } from '../../components/Contacts/ContactForm';
import api from '../../lib/api';

function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function ContactsPage() {
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { search, limit: 50 } });
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

  const contacts = data?.data || [];

  const handleCreate = () => { setEditingContact(null); setIsModalOpen(true); };
  const handleEdit = (c) => { setEditingContact(c); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingContact(null); };

  return (
    <div className="app-layout">

      <Topbar 
        title="Contactos" 
        subtitle={`${contacts.length} contactos registrados`} 
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} />
            Nuevo contacto
          </button>
        } 
      />

      <main className="main-content">
        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Buscar por nombre, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
              Agrega personas de contacto y vincúlalas a sus empresas.
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
                      background: 'linear-gradient(135deg, var(--clr-primary-500), #7c3aed)',
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
                  {contact.is_primary && (
                    <span className="badge badge--primary" style={{ fontSize: '10px' }}>Principal</span>
                  )}
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
                  {contact.company_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      <Building2 size={13} style={{ flexShrink: 0 }} />
                      {contact.company_name}
                    </div>
                  )}
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
