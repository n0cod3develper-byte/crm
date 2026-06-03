import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, User, Phone, Mail, Filter, Trash2, Edit, Download, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { EmployeeForm } from '../../components/Employees/EmployeeForm';
import { ImportEmployeesModal } from '../../components/Employees/ImportEmployeesModal';
import api from '../../lib/api';

const STATUS_COLORS = {
  'Activo': { bg: '#22c55e20', text: '#22c55e' },
  'Inactivo': { bg: '#ef444420', text: '#ef4444' },
  'Vacaciones': { bg: '#eab30820', text: '#eab308' }
};

export function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [filterPos, setFilterPos] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, filterPos],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterPos !== 'all') params.position = filterPos;
      const { data } = await api.get('/employees', { params });
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      toast.success('Empleado eliminado');
      qc.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const employees = data?.data || [];

  const handleCreate = () => { setEditingEmployee(null); setIsModalOpen(true); };
  const handleEdit = (em) => { setEditingEmployee(em); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingEmployee(null); };

  const handleExport = () => {
    if (employees.length === 0) {
      toast.error('No hay empleados para exportar');
      return;
    }
    const exportData = employees.map(emp => ({
      full_name: emp.full_name,
      email: emp.email,
      identification: emp.identification || '',
      phone: emp.phone || '',
      company: emp.company || '',
      position: emp.position,
      status: emp.status,
      hourly_rate: emp.hourly_rate || 0,
      created_at: emp.created_at ? new Date(emp.created_at).toLocaleString('es-CO') : '',
      updated_at: emp.updated_at ? new Date(emp.updated_at).toLocaleString('es-CO') : ''
    }));
    
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'empleados.csv';
    link.click();
    toast.success('Lista de empleados exportada');
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Empleados" 
        subtitle={`${employees.length} registrados`} 
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--outline" onClick={() => setIsImportModalOpen(true)}>
              <Upload size={16} /> Importar
            </button>
            <button className="btn btn--outline" onClick={handleExport}>
              <Download size={16} /> Exportar
            </button>
            <button id="btn-new-employee" className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} /> Nuevo
            </button>
          </div>
        }
      />

      <main className="main-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="employee-search"
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            id="employee-filter-pos"
            className="input"
            style={{ width: 'auto' }}
            value={filterPos}
            onChange={e => setFilterPos(e.target.value)}
          >
            <option value="all">Todos los cargos</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Operario">Operario</option>
            <option value="Técnico">Técnico</option>
          </select>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <User size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin empleados</h2>
            <p className="empty-state__desc">Agrega personal a tu nómina para comenzar a gestionarlos.</p>
            <button className="btn btn--primary" onClick={handleCreate}>Crear empleado</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {employees.map(emp => (
              <div key={emp.id} className="card" style={{ padding: '1.25rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'var(--clr-primary-500)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700
                  }}>
                    {emp.full_name[0].toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: 9999, fontWeight: 700,
                    background: STATUS_COLORS[emp.status]?.bg || '#ccc2',
                    color: STATUS_COLORS[emp.status]?.text || '#ccc'
                  }}>
                    {emp.status}
                  </span>
                </div>
                
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: '0.25rem' }}>{emp.full_name}</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '1rem' }}>{emp.position}</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <Phone size={14} /> {emp.phone || 'Sin télefono'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <Mail size={14} /> {emp.email}
                  </div>
                  {Number(emp.hourly_rate) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      <strong>Tarifa/h:</strong> ${Number(emp.hourly_rate).toLocaleString('es-CO')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => handleEdit(emp)}>
                    <Edit size={14} /> Editar
                  </button>
                  <button className="btn btn--ghost btn--sm" style={{ flex: 1, color: 'var(--clr-danger)' }} onClick={() => {
                    if (window.confirm('¿Eliminar empleado?')) deleteMutation.mutate(emp.id);
                  }}>
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal title={editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'} onClose={handleClose}>
          <EmployeeForm
            employee={editingEmployee}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        </Modal>
      )}

      {isImportModalOpen && (
        <ImportEmployeesModal 
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            qc.invalidateQueries({ queryKey: ['employees'] });
          }}
        />
      )}
    </div>
  );
}
