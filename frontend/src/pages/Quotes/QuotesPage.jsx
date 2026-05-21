import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Download, Target, Trash2, Edit2, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { QuoteForm } from '../../components/Quotes/QuoteForm';
import api from '../../lib/api';
import { generateQuotePDF } from '../../lib/pdfGenerator';

const STATUS_COLORS = {
  draft: { bg: '#f1f5f9', color: '#475569', label: 'Borrador' },
  sent: { bg: '#e0f2fe', color: '#0284c7', label: 'Enviada' },
  viewed: { bg: '#fef08a', color: '#854d0e', label: 'Vista' },
  accepted: { bg: '#dcfce3', color: '#166534', label: 'Aceptada' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazada' },
  expired: { bg: '#f4f4f5', color: '#52525b', label: 'Expirada' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

export function QuotesPage() {
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingQuote, setEditingQuote] = React.useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search],
    queryFn: async () => {
      const params = { limit: 50 };
      if (search) params.search = search;
      const { data } = await api.get('/quotes', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/quotes/${id}`),
    onSuccess: () => {
      toast.success('Cotización eliminada');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const quotes = data?.data || [];

  const handleCreate = () => { setEditingQuote(null); setIsModalOpen(true); };
  
  const handleEdit = async (q) => {
    try {
      const { data } = await api.get(`/quotes/${q.id}`);
      setEditingQuote(data.data);
      setIsModalOpen(true);
    } catch (err) {
      toast.error('Error al cargar la cotización');
    }
  };

  const handleDownloadPDF = async (q) => {
    const loadingToast = toast.loading('Generando PDF...');
    try {
      // Necesitamos cargar todos los items para el PDF
      const { data } = await api.get(`/quotes/${q.id}`);
      generateQuotePDF(data.data);
      toast.success('PDF generado exitosamente', { id: loadingToast });
    } catch (err) {
      toast.error('Error al generar PDF', { id: loadingToast });
    }
  };

  const handleClose = () => { setIsModalOpen(false); setEditingQuote(null); };

  return (
    <div className="app-layout">

      <Topbar 
        title="Cotizaciones" 
        subtitle="Gestiona propuestas y presupuestos comerciales" 
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nueva cotización
          </button>
        } 
      />

      <main className="main-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar por número o empresa…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin cotizaciones</h2>
            <p className="empty-state__desc">Aún no has creado ninguna cotización. Genera la primera propuesta.</p>
            <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear cotización</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>N° Cotización</th>
                  <th>Empresa</th>
                  <th>Oportunidad</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const statusInfo = STATUS_COLORS[q.status] || STATUS_COLORS.draft;
                  const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status !== 'accepted';

                  return (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)' }}>{q.quote_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{q.company_name || '—'}</div>
                        {q.contact_name && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{q.contact_name}</div>}
                      </td>
                      <td>
                        {q.opportunity_title ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                            <Target size={14} /> {q.opportunity_title}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {formatCurrency(q.total)}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: isExpired ? STATUS_COLORS.expired.bg : statusInfo.bg,
                          color: isExpired ? STATUS_COLORS.expired.color : statusInfo.color
                        }}>
                          {isExpired ? 'Expirada' : statusInfo.label}
                        </span>
                      </td>
                      <td>
                        {q.valid_until ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-xs)', color: isExpired ? 'var(--clr-danger)' : 'var(--text-secondary)' }}>
                            <Calendar size={14} />
                            {new Date(q.valid_until).toLocaleDateString('es-CO')}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          className="btn btn--ghost btn--sm" 
                          style={{ padding: '0.375rem', color: 'var(--text-secondary)' }} 
                          onClick={() => handleDownloadPDF(q)}
                          title="Descargar PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button className="btn btn--ghost btn--sm" style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }} onClick={() => handleEdit(q)} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn--ghost btn--sm" 
                          style={{ padding: '0.375rem', color: 'var(--clr-danger)' }} 
                          onClick={() => {
                            if(window.confirm('¿Seguro de eliminar esta cotización?')) {
                              deleteMutation.mutate(q.id);
                            }
                          }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal 
             title={editingQuote ? `Editar Cotización ${editingQuote.quote_number}` : 'Nueva Cotización'} 
             onClose={handleClose}
             maxWidth="1100px"
        >
          <div style={{ width: '100%', minWidth: 'min(90vw, 800px)' }}>
            <QuoteForm quote={editingQuote} onSuccess={handleClose} onCancel={handleClose} />
          </div>
        </Modal>
      )}


    </div>
  );
}
