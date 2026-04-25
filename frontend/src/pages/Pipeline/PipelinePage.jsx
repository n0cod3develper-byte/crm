import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, DollarSign, TrendingUp, Target } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { OpportunityForm } from '../../components/Opportunities/OpportunityForm';
import api from '../../lib/api';

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

export function PipelinePage() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingOpp, setEditingOpp] = React.useState(null);
  const [defaultStageId, setDefaultStageId] = React.useState(null);

  const queryClient = useQueryClient();

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => { const { data } = await api.get('/pipeline/stages'); return data.data; },
  });

  const { data: oppsData } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => { const { data } = await api.get('/opportunities', { params: { limit: 200 } }); return data.data; },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage_id, from_stage_id }) => {
      const { data } = await api.patch(`/opportunities/${id}/move`, { stage_id, from_stage_id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Error al mover'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/opportunities/${id}`),
    onSuccess: () => {
      toast.success('Oportunidad eliminada');
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });

  const opportunities = oppsData || [];
  const openStages = stages?.filter(s => !s.is_closed_won && !s.is_closed_lost) || [];
  const closedStages = stages?.filter(s => s.is_closed_won || s.is_closed_lost) || [];

  const oppsByStage = (stageId) => opportunities.filter(o => o.stage_id === stageId);

  const totalValue = opportunities.reduce((sum, o) => sum + parseFloat(o.value || 0), 0);
  const weightedValue = opportunities.reduce((sum, o) => sum + parseFloat(o.value || 0) * (o.probability || 0) / 100, 0);

  const handleCreate = (stageId) => {
    setEditingOpp(null);
    setDefaultStageId(stageId || openStages[0]?.id);
    setIsModalOpen(true);
  };
  const handleEdit = (opp) => { setEditingOpp(opp); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingOpp(null); setDefaultStageId(null); };

  const handleDragStart = (e, opp) => {
    e.dataTransfer.setData('opp_id', opp.id);
    e.dataTransfer.setData('from_stage', opp.stage_id);
    e.target.style.opacity = '0.4';
  };
  const handleDragEnd = (e) => { e.target.style.opacity = '1'; };
  const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; };
  const handleDragLeave = (e) => { e.currentTarget.style.background = ''; };
  const handleDrop = (e, targetStageId) => {
    e.preventDefault();
    e.currentTarget.style.background = '';
    const oppId = e.dataTransfer.getData('opp_id');
    const fromStage = e.dataTransfer.getData('from_stage');
    if (fromStage !== targetStageId) {
      moveMutation.mutate({ id: oppId, stage_id: targetStageId, from_stage_id: fromStage });
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />

      <Topbar 
        title="Pipeline" 
        subtitle={`${opportunities.length} oportunidades activas`} 
        rightContent={
          <button className="btn btn--primary" onClick={() => handleCreate()}>
            <Plus size={16} /> Nueva oportunidad
          </button>
        } 
      />

      <main className="main-content" style={{ overflowX: 'auto' }}>
        {/* Summary cards */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 200px' }}>
            <Target size={20} style={{ color: 'var(--clr-primary-500)' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total oportunidades</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{opportunities.length}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 200px' }}>
            <DollarSign size={20} style={{ color: '#4ade80' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Valor total</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{formatCurrency(totalValue)}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 200px' }}>
            <TrendingUp size={20} style={{ color: '#fb923c' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Valor ponderado</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{formatCurrency(weightedValue)}</div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div style={{ display: 'flex', gap: '1rem', minWidth: 'max-content', paddingBottom: '1rem' }}>
          {openStages.map(stage => {
            const stageOpps = oppsByStage(stage.id);
            const stageTotal = stageOpps.reduce((s, o) => s + parseFloat(o.value || 0), 0);

            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
                style={{
                  width: 280, minWidth: 280, display: 'flex', flexDirection: 'column',
                  borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0,
                  transition: 'background 0.2s',
                }}
              >
                {/* Stage header */}
                <div style={{
                  padding: '0.875rem 1rem', borderBottom: '2px solid',
                  borderColor: stage.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{stage.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {stageOpps.length} — {formatCurrency(stageTotal)}
                    </div>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleCreate(stage.id)}
                    style={{ padding: '0.25rem' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Cards container */}
                <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 120, flex: 1 }}>
                  {stageOpps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0.5rem', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                      Arrastra aquí
                    </div>
                  ) : (
                    stageOpps.map(opp => (
                      <div
                        key={opp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleEdit(opp)}
                        className="card"
                        style={{
                          padding: '0.75rem', cursor: 'grab', transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
                          {opp.title}
                        </div>
                        {opp.company_name && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            🏢 {opp.company_name}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--clr-primary-400)' }}>
                            {formatCurrency(opp.value)}
                          </span>
                          <span style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: '9999px',
                            background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                          }}>
                            {opp.probability}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Closed stages as collapsed columns */}
          {closedStages.map(stage => {
            const stageOpps = oppsByStage(stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
                style={{
                  width: 180, minWidth: 180, display: 'flex', flexDirection: 'column',
                  borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)', opacity: 0.75, flexShrink: 0,
                }}
              >
                <div style={{
                  padding: '0.875rem 1rem', borderBottom: '2px solid', borderColor: stage.color,
                  textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{stage.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {stageOpps.length} deals
                  </div>
                </div>
                <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 80 }}>
                  {stageOpps.map(opp => (
                    <div key={opp.id} className="card" style={{ padding: '0.5rem', fontSize: 'var(--text-xs)' }}
                      onClick={() => handleEdit(opp)}>
                      <div style={{ fontWeight: 600 }}>{opp.title}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{formatCurrency(opp.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {isModalOpen && (
        <Modal title={editingOpp ? 'Editar Oportunidad' : 'Nueva Oportunidad'} onClose={handleClose}>
          <OpportunityForm
            opportunity={editingOpp}
            defaultStageId={defaultStageId}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        </Modal>
      )}
    </div>
  );
}
