import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Search, Trash2, Edit2, Zap, BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { CampaignForm } from '../../components/Campaigns/CampaignForm';
import api from '../../lib/api';

const STATUS_MAP = {
  planned: { label: 'Planeada', bg: '#f1f5f9', color: '#475569' },
  active: { label: 'Activa', bg: '#dcfce3', color: '#166534' },
  paused: { label: 'Pausada', bg: '#fef08a', color: '#854d0e' },
  completed: { label: 'Completada', bg: '#e0f2fe', color: '#0284c7' },
  cancelled: { label: 'Cancelada', bg: '#fee2e2', color: '#991b1b' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

export function CampaignsPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', search],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      const { data } = await api.get('/campaigns', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/campaigns/${id}`),
    onSuccess: () => {
      toast.success('Campaña eliminada');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const campaigns = data?.data || [];

  const handleCreate = () => {
    setEditingCampaign(null);
    setIsModalOpen(true);
  };

  const handleEdit = (c) => {
    setEditingCampaign(c);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingCampaign(null);
  };

  // Stats calculation
  const stats = campaigns.reduce((acc, c) => {
    if (c.status === 'active') acc.active++;
    acc.totalBudget += parseFloat(c.budget) || 0;
    acc.totalSpent += parseFloat(c.actual_cost) || 0;
    return acc;
  }, { active: 0, totalBudget: 0, totalSpent: 0 });

  return (
    <div className="app-layout">

      <Topbar 
        title="Campañas de Marketing" 
        subtitle="Mide el Retorno de Inversión (ROI) y administra presupuestos" 
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nueva Campaña
          </button>
        } 
      />

      <main className="main-content">
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#e0f2fe', color: '#0284c7', borderRadius: '50%' }}>
              <Zap size={24} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Campañas Activas</p>
              <h3 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.active}</h3>
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#fef08a', color: '#854d0e', borderRadius: '50%' }}>
              <BarChart3 size={24} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Presupuesto Total Planeado</p>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{formatCurrency(stats.totalBudget)}</h3>
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '50%' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Costo Real Invertido</p>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{formatCurrency(stats.totalSpent)}</h3>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              className="input" 
              style={{ paddingLeft: '2.5rem' }} 
              placeholder="Buscar campañas..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin campañas</h2>
            <p className="empty-state__desc">No tienes estrategias de marketing registradas.</p>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} /> Crear primera campaña
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Estado</th>
                  <th>Inversión (Meta/Real)</th>
                  <th>Ingreso Proyectado</th>
                  <th>Ingreso Real</th>
                  <th style={{ textAlign: 'center' }}>Utilidad</th>
                  <th style={{ textAlign: 'center' }}>ROI</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const statusInfo = STATUS_MAP[c.status] || STATUS_MAP.planned;
                  
                  const cost = parseFloat(c.actual_cost) || parseFloat(c.budget) || 0; 
                  const actualRev = parseFloat(c.actual_revenue) || 0;
                  const expectedRev = parseFloat(c.expected_revenue) || 0;
                  
                  const activeRevenue = actualRev > 0 ? actualRev : expectedRev;
                  const profit = activeRevenue - cost;
                  const investmentForRoi = cost > 0 ? cost : (parseFloat(c.budget) || 1);
                  const roiPercent = investmentForRoi > 0 ? ((activeRevenue - investmentForRoi) / investmentForRoi) * 100 : 0;
                  const usingActual = actualRev > 0;

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{c.type || 'General'}</div>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: statusInfo.bg, color: statusInfo.color
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                         <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{formatCurrency(c.budget)}</div>
                         {c.actual_cost > 0 && (
                           <div style={{ fontSize: '11px', color: c.actual_cost > c.budget ? 'var(--clr-danger)' : 'var(--text-muted)' }}>
                             Real: {formatCurrency(c.actual_cost)}
                           </div>
                         )}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        {formatCurrency(c.expected_revenue)}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-primary-600)', fontWeight: 600 }}>
                        {formatCurrency(c.actual_revenue)}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700, color: profit >= 0 ? 'var(--clr-primary-500)' : 'var(--clr-danger)' }}>
                        {formatCurrency(profit)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {roiPercent !== 0 ? (
                           <div style={{ 
                             display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', 
                             background: roiPercent > 0 ? '#dcfce3' : '#fee2e2', 
                             color: roiPercent > 0 ? '#166534' : '#991b1b', 
                             borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 
                           }}>
                             {roiPercent > 0 ? <TrendingUp size={12} /> : null}
                             {roiPercent > 0 ? '+' : ''}{roiPercent.toFixed(1)}%
                             {usingActual && <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.8 }}>(Real)</span>}
                           </div>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn--ghost btn--sm" style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }} onClick={() => handleEdit(c)}>
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn--ghost btn--sm" 
                          style={{ padding: '0.375rem', color: 'var(--clr-danger)' }} 
                          onClick={() => {
                            if(window.confirm('¿Eliminar campaña?')) deleteMutation.mutate(c.id);
                          }}
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
          title={editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'} 
          onClose={handleClose}
          maxWidth="700px"
        >
          <CampaignForm campaign={editingCampaign} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>
      )}
    </div>
  );
}
