import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { emailMarketingApi } from '../../services/emailMarketingApi';
import api from '../../lib/api'; // para cargar empresas/contactos del CRM
import { Plus, Search, Trash2, Edit2, List, Users, Check, Import, X, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/common/Modal';

export function ContactosListaPage() {
  const [activeTab, setActiveTab] = useState('listas');
  const [search, setSearch] = useState('');
  const [isListaModalOpen, setIsListaModalOpen] = useState(false);
  const [isContactoModalOpen, setIsContactoModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [selectedLista, setSelectedLista] = useState(null);
  const [editingLista, setEditingLista] = useState(null);
  const [editingContacto, setEditingContacto] = useState(null);

  // Form states
  const [listaForm, setListaForm] = useState({ nombre: '', descripcion: '' });
  const [contactoForm, setContactoForm] = useState({ nombre: '', correo: '', empresa_id: '', origen: 'manual' });
  const [importForm, setImportForm] = useState({ empresa_id: '' });

  const queryClient = useQueryClient();

  // Queries
  const { data: listasData, isLoading: isLoadingListas } = useQuery({
    queryKey: ['email_listas', search],
    queryFn: () => emailMarketingApi.getListas({ search }),
  });

  const { data: contactosData, isLoading: isLoadingContactos } = useQuery({
    queryKey: ['email_contactos', search, selectedLista?.id],
    queryFn: () => emailMarketingApi.getContactos({ 
      search, 
      lista_id: selectedLista?.id || undefined 
    }),
  });

  const { data: CRMCompanies } = useQuery({
    queryKey: ['crm_companies_all'],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params: { limit: 1000 } });
      return data?.data || [];
    }
  });

  // Mutations Listas
  const createListaMutation = useMutation({
    mutationFn: emailMarketingApi.createLista,
    onSuccess: () => {
      toast.success('Lista creada con éxito');
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
      setIsListaModalOpen(false);
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Error al crear la lista')
  });

  const updateListaMutation = useMutation({
    mutationFn: ({ id, data }) => emailMarketingApi.updateLista(id, data),
    onSuccess: () => {
      toast.success('Lista actualizada');
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
      setIsListaModalOpen(false);
    }
  });

  const deleteListaMutation = useMutation({
    mutationFn: emailMarketingApi.deleteLista,
    onSuccess: () => {
      toast.success('Lista eliminada');
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
    }
  });

  // Mutations Contactos
  const createContactoMutation = useMutation({
    mutationFn: emailMarketingApi.createContacto,
    onSuccess: async (res) => {
      toast.success('Contacto creado');
      if (selectedLista) {
        await emailMarketingApi.agregarContactoALista(selectedLista.id, res.data.id);
      }
      queryClient.invalidateQueries({ queryKey: ['email_contactos'] });
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
      setIsContactoModalOpen(false);
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Error al guardar contacto')
  });

  const updateContactoMutation = useMutation({
    mutationFn: ({ id, data }) => emailMarketingApi.updateContacto(id, data),
    onSuccess: () => {
      toast.success('Contacto actualizado');
      queryClient.invalidateQueries({ queryKey: ['email_contactos'] });
      setIsContactoModalOpen(false);
    }
  });

  const deleteContactoMutation = useMutation({
    mutationFn: emailMarketingApi.deleteContacto,
    onSuccess: () => {
      toast.success('Contacto eliminado');
      queryClient.invalidateQueries({ queryKey: ['email_contactos'] });
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
    }
  });

  const quitarDeListaMutation = useMutation({
    mutationFn: ({ listaId, contactoId }) => emailMarketingApi.quitarContactoDeLista(listaId, contactoId),
    onSuccess: () => {
      toast.success('Contacto removido de la lista');
      queryClient.invalidateQueries({ queryKey: ['email_contactos'] });
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
    }
  });

  const importMutation = useMutation({
    mutationFn: ({ listaId, empresaId }) => emailMarketingApi.importarContactos(listaId, empresaId),
    onSuccess: (res) => {
      const { creados, ya_existian } = res.data;
      toast.success(`Importación finalizada. Creados: ${creados}, Vinculados: ${ya_existian}`);
      queryClient.invalidateQueries({ queryKey: ['email_contactos'] });
      queryClient.invalidateQueries({ queryKey: ['email_listas'] });
      setIsImportModalOpen(false);
    }
  });

  // Handlers
  const handleOpenListaModal = (lista = null) => {
    if (lista) {
      setEditingLista(lista);
      setListaForm({ nombre: lista.nombre, descripcion: lista.descripcion });
    } else {
      setEditingLista(null);
      setListaForm({ nombre: '', descripcion: '' });
    }
    setIsListaModalOpen(true);
  };

  const handleSaveLista = (e) => {
    e.preventDefault();
    if (editingLista) {
      updateListaMutation.mutate({ id: editingLista.id, data: listaForm });
    } else {
      createListaMutation.mutate(listaForm);
    }
  };

  const handleOpenContactoModal = (contacto = null) => {
    if (contacto) {
      setEditingContacto(contacto);
      setContactoForm({ 
        nombre: contacto.nombre, 
        correo: contacto.correo, 
        empresa_id: contacto.empresa_id || '',
        origen: contacto.origen || 'manual',
        consentimiento_tipo: contacto.consentimiento_tipo || 'relacion_comercial',
        consentimiento_fuente: contacto.consentimiento_fuente || ''
      });
    } else {
      setEditingContacto(null);
      setContactoForm({ 
        nombre: '', 
        correo: '', 
        empresa_id: '', 
        origen: 'manual', 
        consentimiento_tipo: 'relacion_comercial',
        consentimiento_fuente: 'Registro manual'
      });
    }
    setIsContactoModalOpen(true);
  };

  const handleSaveContacto = (e) => {
    e.preventDefault();
    if (editingContacto) {
      updateContactoMutation.mutate({ id: editingContacto.id, data: contactoForm });
    } else {
      createContactoMutation.mutate(contactoForm);
    }
  };

  const handleImport = (e) => {
    e.preventDefault();
    if (!selectedLista) return;
    importMutation.mutate({ listaId: selectedLista.id, empresaId: importForm.empresa_id });
  };

  return (
    <Layout
      title={selectedLista ? `Lista: ${selectedLista.nombre}` : 'Contactos y Segmentación'}
      subtitle={selectedLista ? selectedLista.descripcion || 'Administra los contactos de esta lista' : 'Gestiona contactos y listas de distribución'}
      rightContent={
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedLista ? (
            <>
              <button className="btn btn--secondary" onClick={() => setSelectedLista(null)}>
                Volver a Listas
              </button>
              <button className="btn btn--secondary" onClick={() => setIsImportModalOpen(true)}>
                <Import size={16} style={{ marginRight: '4px' }} /> Importar CRM
              </button>
              <button className="btn btn--primary" onClick={() => handleOpenContactoModal(null)}>
                <UserPlus size={16} style={{ marginRight: '4px' }} /> Nuevo Contacto
              </button>
            </>
          ) : (
            <button className="btn btn--primary" onClick={() => handleOpenListaModal(null)}>
              <Plus size={16} style={{ marginRight: '4px' }} /> Nueva Lista
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            className="input" 
            style={{ paddingLeft: '2.5rem' }} 
            placeholder={selectedLista ? "Buscar contactos en la lista..." : "Buscar listas o contactos..."}
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {!selectedLista ? (
        // VISTA LISTAS
        isLoadingListas ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : listasData?.data?.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <List size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>No hay listas creadas</h3>
            <p>Comienza creando una lista de distribución para tus campañas.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {listasData?.data?.map((lista) => (
              <div className="card" key={lista.id} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{lista.nombre}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flexGrow: 1, marginBottom: '1rem' }}>
                  {lista.descripcion || 'Sin descripción.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>{lista.total_contactos_activos} contactos activos</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn--ghost btn--sm" style={{ padding: '4px' }} onClick={() => setSelectedLista(lista)}>
                      <Users size={16} />
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ padding: '4px' }} onClick={() => handleOpenListaModal(lista)}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ padding: '4px', color: 'var(--clr-danger)' }} onClick={() => {
                      if (window.confirm('¿Eliminar esta lista? No se borrarán los contactos agregados a ella.')) {
                        deleteListaMutation.mutate(lista.id);
                      }
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // VISTA CONTACTOS DE UNA LISTA
        isLoadingContactos ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : contactosData?.data?.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>No hay contactos en esta lista</h3>
            <p>Agrega contactos manualmente o impórtalos de las empresas registradas en el CRM.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Empresa</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contactosData?.data?.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td>{c.correo}</td>
                    <td>{c.empresa_nombre || '—'}</td>
                    <td style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{c.origen.replace('_', ' ')}</td>
                    <td>
                      <span className={`badge badge--${c.estado === 'activo' ? 'success' : c.estado === 'baja' ? 'danger' : 'warning'}`}>
                        {c.estado === 'activo' ? 'Activo' : c.estado === 'baja' ? 'Baja' : 'Rebotado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => handleOpenContactoModal(c)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} onClick={() => {
                        if (window.confirm('¿Remover este contacto de esta lista de distribución?')) {
                          quitarDeListaMutation.mutate({ listaId: selectedLista.id, contactoId: c.id });
                        }
                      }}>
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL LISTAS */}
      {isListaModalOpen && (
        <Modal title={editingLista ? 'Editar Lista' : 'Nueva Lista'} onClose={() => setIsListaModalOpen(false)}>
          <form onSubmit={handleSaveLista} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Nombre de la lista</label>
              <input className="input" required value={listaForm.nombre} onChange={e => setListaForm({ ...listaForm, nombre: e.target.value })} />
            </div>
            <div>
              <label className="label">Descripción</label>
              <textarea className="input" style={{ minHeight: '80px' }} value={listaForm.descripcion} onChange={e => setListaForm({ ...listaForm, descripcion: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsListaModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL CONTACTOS */}
      {isContactoModalOpen && (
        <Modal title={editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'} onClose={() => setIsContactoModalOpen(false)}>
          <form onSubmit={handleSaveContacto} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Nombre Completo</label>
              <input className="input" required value={contactoForm.nombre} onChange={e => setContactoForm({ ...contactoForm, nombre: e.target.value })} />
            </div>
            <div>
              <label className="label">Correo Electrónico</label>
              <input className="input" type="email" required value={contactoForm.correo} onChange={e => setContactoForm({ ...contactoForm, correo: e.target.value })} />
            </div>
            <div>
              <label className="label">Empresa vinculada (opcional)</label>
              <select className="input" value={contactoForm.empresa_id} onChange={e => setContactoForm({ ...contactoForm, empresa_id: e.target.value })}>
                <option value="">Ninguna</option>
                {CRMCompanies?.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Base Legal / Consentimiento (Habeas Data Ley 1581)</label>
              <select 
                className="input" 
                value={contactoForm.consentimiento_tipo} 
                onChange={e => setContactoForm({ ...contactoForm, consentimiento_tipo: e.target.value })}
              >
                <option value="relacion_comercial">Relación comercial preexistente (Art. 10 Ley 1581)</option>
                <option value="explicito">Consentimiento explícito / Opt-in registrado</option>
                <option value="pendiente">Pendiente por confirmar</option>
              </select>
            </div>
            <div>
              <label className="label">Fuente del consentimiento</label>
              <input 
                className="input" 
                placeholder="Ej. Formulario web, acuerdo de servicio..." 
                value={contactoForm.consentimiento_fuente} 
                onChange={e => setContactoForm({ ...contactoForm, consentimiento_fuente: e.target.value })} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsContactoModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL IMPORTAR */}
      {isImportModalOpen && (
        <Modal title="Importar desde CRM" onClose={() => setIsImportModalOpen(false)}>
          <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Selecciona una empresa del CRM. Se importará su información de contacto principal y todos los contactos vinculados a esa empresa que tengan dirección de correo registrada.
            </p>
            <div>
              <label className="label">Empresa del CRM</label>
              <select className="input" required value={importForm.empresa_id} onChange={e => setImportForm({ empresa_id: e.target.value })}>
                <option value="">Seleccionar empresa...</option>
                {CRMCompanies?.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name} {comp.nit ? `(${comp.nit})` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsImportModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={importMutation.isLoading}>
                {importMutation.isLoading ? 'Importando...' : 'Iniciar Importación'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
