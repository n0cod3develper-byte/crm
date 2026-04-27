import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  History, ArrowUpRight, ArrowDownLeft, RefreshCcw, 
  Plus, Search, Calendar, User, FileText, Package 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import api from '../../lib/api';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function MovementsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const queryClient = useQueryClient();

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['inventory-movements', filterType],
    queryFn: async () => {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      const { data } = await api.get('/movements', { params });
      return data;
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ['inventory-movements-stats'],
    queryFn: async () => {
      const { data } = await api.get('/movements/stats');
      return data;
    }
  });

  const movements = movementsData?.data || [];
  const stats = statsData?.data || {};

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Movimientos de Inventario" 
        subtitle="Registro de entradas, salidas y ajustes de stock"
        rightContent={
          <button className="btn btn--primary flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Registrar Movimiento
          </button>
        }
      />
      <main className="main-content">
        
        {/* Dashboard de Movimientos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--clr-success)' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.1)', color: 'var(--clr-success)', borderRadius: '50%' }}>
                <ArrowDownLeft size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entradas (30d)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.total_in || 0} unidades</div>
              </div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid var(--clr-danger)' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--clr-danger)', borderRadius: '50%' }}>
                <ArrowUpRight size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Salidas (30d)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.total_out || 0} unidades</div>
              </div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid var(--clr-warning)' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '0.75rem', background: 'rgba(234,179,8,0.1)', color: 'var(--clr-warning)', borderRadius: '50%' }}>
                <RefreshCcw size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Frecuencia</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{(movements.length)} movs.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Listado de Movimientos */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Historial de Transacciones</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'in', 'out', 'adjustment'].map(type => (
                <button 
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`btn btn--sm ${filterType === type ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {type === 'all' ? 'Todos' : type === 'in' ? 'Entradas' : type === 'out' ? 'Salidas' : 'Ajustes'}
                </button>
              ))}
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ítem / Código</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Referencia / Nota</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay movimientos registrados.</td></tr>
                ) : movements.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 600 }}>{format(new Date(m.created_at), 'dd MMM, yyyy', { locale: es })}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{format(new Date(m.created_at), 'HH:mm')}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 700 }}>{m.item_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--clr-primary-500)', fontWeight: 600 }}>{m.codigo_interno}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${m.type === 'in' ? 'badge--success' : m.type === 'out' ? 'badge--danger' : 'badge--warning'}`}>
                        {m.type === 'in' ? 'ENTRADA' : m.type === 'out' ? 'SALIDA' : 'AJUSTE'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: m.type === 'in' ? 'var(--clr-success)' : m.type === 'out' ? 'var(--clr-danger)' : 'var(--text-primary)' }}>
                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                      </span>
                    </td>
                    <td>
                      <div style={{ maxWidth: '250px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.reference || 'Sin ref.'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.notes}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} />
                        </div>
                        {m.user_name || 'Sistema'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {isModalOpen && (
        <Modal title="Registrar Movimiento" onClose={() => setIsModalOpen(false)}>
          <MovementForm onSuccess={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries(['inventory-movements']);
            queryClient.invalidateQueries(['inventory-movements-stats']);
            queryClient.invalidateQueries(['catalog-items']);
          }} />
        </Modal>
      )}
    </div>
  );
}

function MovementForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    item_id: '',
    type: 'in',
    quantity: 1,
    reference: '',
    notes: ''
  });

  const { data: itemsData } = useQuery({
    queryKey: ['catalog-items-lite'],
    queryFn: async () => {
      const { data } = await api.get('/catalogo', { params: { limit: 1000 } });
      return data;
    }
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/movements', data),
    onSuccess: () => {
      toast.success('Movimiento registrado correctamente');
      onSuccess();
    },
    onError: (err) => {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.item_id) return toast.error('Debe seleccionar un producto');
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
      <div className="input-group">
        <label className="input-label">Producto / Servicio</label>
        <select 
          className="input" 
          value={formData.item_id} 
          onChange={e => setFormData({...formData, item_id: e.target.value})}
          required
        >
          <option value="">Seleccione un item...</option>
          {itemsData?.items?.filter(i => i.tipo === 'PRODUCTO').map(i => (
            <option key={i.id} value={i.id}>{i.nombre_comercial} ({i.codigo_interno}) - Stock: {i.stock_actual}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="input-group">
          <label className="input-label">Tipo de Movimiento</label>
          <select 
            className="input" 
            value={formData.type} 
            onChange={e => setFormData({...formData, type: e.target.value})}
          >
            <option value="in">Entrada (+)</option>
            <option value="out">Salida (-)</option>
            <option value="adjustment">Ajuste de Auditoría</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Cantidad</label>
          <input 
            type="number" 
            className="input" 
            min="1" 
            value={formData.quantity} 
            onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} 
            required 
          />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Referencia (Ej: Factura #, OT #)</label>
        <input 
          type="text" 
          className="input" 
          value={formData.reference} 
          onChange={e => setFormData({...formData, reference: e.target.value})} 
        />
      </div>

      <div className="input-group">
        <label className="input-label">Notas Adicionales</label>
        <textarea 
          className="input" 
          rows="3" 
          value={formData.notes} 
          onChange={e => setFormData({...formData, notes: e.target.value})}
        />
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button type="submit" className="btn btn--primary px-8" disabled={mutation.isLoading}>
          {mutation.isLoading ? 'Registrando...' : 'Confirmar Movimiento'}
        </button>
      </div>
    </form>
  );
}
