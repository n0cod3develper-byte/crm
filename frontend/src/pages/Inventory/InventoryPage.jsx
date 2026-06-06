import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Box, Trash2, Edit2, Download, Wrench, Building2, Monitor, HardHat, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { InventoryForm } from '../../components/Inventory/InventoryForm';
import { ExportInventoryModal } from '../../components/Inventory/ExportInventoryModal';
import api from '../../lib/api';

const AREAS = [
  { value: 'all', label: 'Todo', icon: null },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento', icon: Wrench, color: '#3B82F6' },
  { value: 'LOCATIVO', label: 'Locativo', icon: Building2, color: '#F97316' },
  { value: 'SISTEMAS', label: 'Sistemas', icon: Monitor, color: '#6366F1' },
  { value: 'SST', label: 'SST', icon: HardHat, color: '#22C55E' },
];

const AREA_COLORS = {
  MANTENIMIENTO: { bg: '#dbeafe', fg: '#1e40af', label: 'Manto.' },
  LOCATIVO:      { bg: '#ffedd5', fg: '#9a3412', label: 'Locativo' },
  SISTEMAS:      { bg: '#e0e7ff', fg: '#3730a3', label: 'Sistemas' },
  SST:           { bg: '#dcfce7', fg: '#166534', label: 'SST' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

export function InventoryPage() {
  const [search, setSearch] = React.useState('');
  const [filterArea, setFilterArea] = React.useState('all');
  const [filterActive, setFilterActive] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [showAreaPicker, setShowAreaPicker] = React.useState(false);
  const [pendingNewArea, setPendingNewArea] = React.useState(null);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', search, filterArea, filterActive],
    queryFn: async () => {
      if (filterArea === 'LOCATIVO') {
        const params = { limit: 50, page: 1 };
        if (search) params.q = search;
        const { data } = await api.get('/inventario/locativo', { params });
        // Normalizar campos del locativo al formato de la tabla de inventario
        const normalized = (data?.data || []).map(item => ({
          ...item,
          id: item.id,
          sku: item.codigo_interno,
          name: item.nombre,
          marca: item.especificaciones?.marca || item.especificaciones?.marca_tablero || '—',
          is_active: item.activo,
          unit_price: item.costo_historico,
          familia_nombre: item.subcategoria_nombre || item.subcategoria,
          ubicacion_fisica: item.sede || item.area_oficina_bodega || '—',
        }));
        return { data: normalized, _isLocativo: true };
      }
      const params = { limit: 50 };
      if (search) params.search = search;
      if (filterArea !== 'all') params.area = filterArea;
      if (filterActive !== 'all') params.isActive = filterActive === 'true';
      const { data } = await api.get('/inventory', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      toast.success('Ítem eliminado');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const items = data?.data || [];
  const isLocativoView = data?._isLocativo && filterArea === 'LOCATIVO';

  const handleCreate = () => {
    setEditingItem(null);
    setShowAreaPicker(true);
    setPendingNewArea(null);
  };

  const handleAreaSelected = (area) => {
    setPendingNewArea(area);
    setShowAreaPicker(false);
    setIsModalOpen(true);
  };

  const handleEdit = (it) => {
    setEditingItem(it);
    setShowAreaPicker(false);
    setPendingNewArea(filterArea !== 'all' ? filterArea : null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setPendingNewArea(null);
  };

  return (
    <div className="app-layout">

      <Topbar 
        title="Inventario y Catálogo" 
        subtitle="Gestiona productos y servicios para tus cotizaciones" 
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => setShowExportModal(true)}>
              <Download size={16} /> Exportar
            </button>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} /> Nuevo Ítem
            </button>
          </div>
        } 
      />

      <main className="main-content">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {AREAS.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.value}
                className={`btn btn--sm ${filterArea === a.value ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilterArea(a.value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  ...(filterArea === a.value && a.color ? { background: a.color, borderColor: a.color } : {}),
                }}
              >
                {Icon && <Icon size={14} />}
                {a.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar por nombre o SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['all', 'true', 'false'].map(s => {
               let label = 'Todos';
               if (s === 'true') label = 'Activos';
               if (s === 'false') label = 'Inactivos';
               return (
                 <button
                   key={s}
                   className={`btn btn--sm ${filterActive === s ? 'btn--primary' : 'btn--ghost'}`}
                   onClick={() => setFilterActive(s)}
                 >
                   {label}
                 </button>
               );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Box size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Inventario vacío</h2>
            <p className="empty-state__desc">No hay elementos que coincidan con la búsqueda.</p>
            <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear Ítem</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Artículo / Servicio</th>
                  <th>Marca</th>
                  {filterArea === 'SISTEMAS' && <th>Código / Placa</th>}
                  {filterArea === 'SISTEMAS' && <th>Tipo Activo</th>}
                  {filterArea === 'SST' && <th>Tipo Elemento</th>}
                  {filterArea === 'SST' && <th>Estado SST</th>}
                  {filterArea === 'SST' && <th>Próx. Revisión</th>}
                  {filterArea === 'LOCATIVO' && <th>Grupo</th>}
                  {filterArea === 'LOCATIVO' && <th>Subcategoría</th>}
                  {filterArea === 'LOCATIVO' && <th>Clasif. Contable</th>}
                  {filterArea === 'LOCATIVO' && <th>Estado Físico</th>}
                  {filterArea === 'LOCATIVO' && <th>Sede</th>}
                  <th>Área</th>
                  {filterArea !== 'LOCATIVO' && <th>Familia</th>}
                  {filterArea !== 'LOCATIVO' && <th>Stock</th>}
                  {filterArea !== 'LOCATIVO' && <th>Ubicación Física</th>}
                  {filterArea === 'SISTEMAS' && <th>Responsable</th>}
                  {filterArea === 'LOCATIVO' && <th>Responsable</th>}
                  {filterArea !== 'LOCATIVO' && <th>Precio Venta</th>}
                  {filterArea === 'LOCATIVO' && <th>Costo Hist.</th>}
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }}>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.sku || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.marca || '—'}</td>
                    {filterArea === 'SISTEMAS' && (
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {item.codigo_activo || '—'}
                        </span>
                      </td>
                    )}
                    {filterArea === 'SISTEMAS' && (
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                          background: '#e0e7ff', color: '#3730a3',
                        }}>
                          {item.tipo_activo || '—'}
                        </span>
                      </td>
                    )}
                    {filterArea === 'SST' && (
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                          background: '#dcfce7', color: '#166534',
                        }}>
                          {item.sst_tipo_elemento ? item.sst_tipo_elemento.replace(/_/g, ' ') : '—'}
                        </span>
                      </td>
                    )}
                    {filterArea === 'SST' && (
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '6px',
                          fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: ({
                            VIGENTE: '#dcfce7', POR_VENCER: '#fef9c3',
                            VENCIDO: '#fee2e2', EN_MANTENIMIENTO: '#dbeafe',
                            FUERA_SERVICIO: '#f1f5f9'
                          })[item.sst_estado] || '#f1f5f9',
                          color: ({
                            VIGENTE: '#166534', POR_VENCER: '#854d0e',
                            VENCIDO: '#991b1b', EN_MANTENIMIENTO: '#1e40af',
                            FUERA_SERVICIO: '#475569'
                          })[item.sst_estado] || '#475569',
                        }}>
                          {item.sst_estado ? item.sst_estado.replace(/_/g, ' ') : '—'}
                        </span>
                      </td>
                    )}
                    {filterArea === 'SST' && (
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.sst_proxima_revision ? new Date(item.sst_proxima_revision).toLocaleDateString('es-CO') : '—'}
                      </td>
                    )}
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: isLocativoView ? '#ffedd5' : (AREA_COLORS[item.area] || { bg: '#f1f5f9' }).bg,
                        color: isLocativoView ? '#9a3412' : (AREA_COLORS[item.area] || { fg: '#475569' }).fg,
                      }}>
                        {isLocativoView ? 'Locativo' : (AREA_COLORS[item.area] || { label: item.area || '—' }).label}
                      </span>
                    </td>
                    <td>{item.familia_nombre || item.category || 'General'}</td>
                    <td>
                      <span style={{ color: item.stock_current <= item.stock_minimum ? 'var(--clr-danger)' : 'inherit', fontWeight: item.stock_current <= item.stock_minimum ? 600 : 400 }}>
                        {item.stock_current} {item.unit || 'und'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1" style={{ color: 'var(--clr-primary-500)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {item.ubicacion_fisica || '---'}
                      </div>
                    </td>
                    {filterArea === 'SISTEMAS' && (
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.responsable_nombre || '—'}
                      </td>
                    )}
                    {filterArea === 'LOCATIVO' && (
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                          background: { A: '#e0e7ff', B: '#ffedd5', C: '#dcfce7' }[item.grupo_locativo] || '#f1f5f9',
                          color: { A: '#3730a3', B: '#9a3412', C: '#166534' }[item.grupo_locativo] || '#475569',
                        }}>{item.grupo_locativo || '—'}</span>
                      </td>
                    )}
                    {filterArea === 'LOCATIVO' && <td style={{ fontSize: '0.8rem' }}>{item.subcategoria_nombre || item.subcategoria || '—'}</td>}
                    {filterArea === 'LOCATIVO' && (
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                          background: item.clasificacion_contable === 'ACTIVO' ? '#e0e7ff' : '#fef3c7',
                          color: item.clasificacion_contable === 'ACTIVO' ? '#3730a3' : '#92400e',
                        }}>{item.clasificacion_contable || '—'}</span>
                      </td>
                    )}
                    {filterArea === 'LOCATIVO' && (
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                          background: { NUEVO: '#dcfce7', BUENO: '#dbeafe', REGULAR: '#fef3c7', MALO: '#fee2e2', DADO_DE_BAJA: '#f1f5f9' }[item.estado_fisico] || '#f1f5f9',
                          color: { NUEVO: '#166534', BUENO: '#1e40af', REGULAR: '#92400e', MALO: '#991b1b', DADO_DE_BAJA: '#475569' }[item.estado_fisico] || '#475569',
                        }}>{item.estado_fisico ? item.estado_fisico.replace(/_/g, ' ') : '—'}</span>
                      </td>
                    )}
                    {filterArea === 'LOCATIVO' && <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.sede || '—'}</td>}
                    <td>{isLocativoView ? 'Locativo' : formatCurrency(item.unit_price)}</td>
                    <td>
                       <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: item.is_active ? '#dcfce3' : '#fee2e2', 
                          color: item.is_active ? '#166534' : '#991b1b'
                        }}>
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      <button className="btn btn--ghost btn--sm" style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }} onClick={() => handleEdit(item)} title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="btn btn--ghost btn--sm" 
                        style={{ padding: '0.375rem', color: 'var(--clr-danger)' }} 
                        onClick={() => {
                          if(window.confirm('¿Seguro de eliminar este ítem permanentemente?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ─── Area Picker (paso intermedio antes del formulario) ─── */}
      {showAreaPicker && <AreaPickerModal onSelect={handleAreaSelected} onClose={() => setShowAreaPicker(false)} />}

      {/* ─── Modal de Exportación ─── */}
      {showExportModal && <ExportInventoryModal onClose={() => setShowExportModal(false)} />}

      {isModalOpen && (
        <Modal title={editingItem ? 'Editar Ítem' : `Nuevo Ítem — ${AREAS.find(a => a.value === pendingNewArea)?.label || ''}`} onClose={handleClose} maxWidth={pendingNewArea === 'SISTEMAS' || pendingNewArea === 'SST' || pendingNewArea === 'LOCATIVO' ? '820px' : undefined}>
          <InventoryForm item={editingItem} defaultArea={pendingNewArea} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>
      )}
    </div>
  );
}

// ─── Componente separado para el Área Picker (con su propio manejador de Escape) ───
function AreaPickerModal({ onSelect, onClose }) {
  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const PICKER_AREAS = [
    { value: 'MANTENIMIENTO', label: 'Mantenimiento', icon: Wrench, color: '#3B82F6' },
    { value: 'LOCATIVO',      label: 'Locativo',      icon: Building2, color: '#F97316' },
    { value: 'SISTEMAS',      label: 'Sistemas',      icon: Monitor, color: '#6366F1' },
    { value: 'SST',           label: 'SST',            icon: HardHat, color: '#22C55E' },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Nuevo Ítem</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        <div className="modal__body">
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Selecciona el área de inventario para el nuevo elemento:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {PICKER_AREAS.map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => onSelect(a.value)}
                  className="area-picker-card"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '0.75rem',
                    padding: '1.75rem 1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {Icon && <Icon size={36} color={a.color} />}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
