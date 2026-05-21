import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ExternalLink, Upload, FileDown, X, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { Modal } from '../../components/common/Modal';
import { CompanyForm } from '../../components/Companies/CompanyForm';

const COLUMNAS_PLANTILLA = ['Nombre', 'NIT', 'Teléfono', 'Dirección', 'Ciudad', 'País', 'Sitio Web', 'Sector', 'Modelo de Captación', 'Régimen', 'Tags', 'Notas'];

function descargarPlantilla() {
  const data = [
    COLUMNAS_PLANTILLA,
    ['Logística del Norte SAS', '900.123.456-7', '+57 601 2345678', 'Calle 50 #30-20, Oficina 301', 'Bogotá', 'Colombia', 'https://logisticanorte.com', 'logistics', 'Google / Buscador', 'RC', 'cliente-activo,flota-propia', 'Cliente desde 2023'],
    ['Transportes del Sur Ltda', '800.987.654-3', '+57 604 8765432', 'Av. Siempre Viva #45-12', 'Medellín', 'Colombia', '', 'logistics', 'Recomendación / Referido', 'NI', '', 'Contacto: Juan Pérez'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Ancho de columna estimado
  ws['!cols'] = COLUMNAS_PLANTILLA.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
  XLSX.writeFile(wb, 'plantilla_importacion_empresas.xlsx');
  toast.success('Plantilla descargada');
}

export function CompaniesPage() {
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);

  // Estado para importación
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [importResult, setImportResult] = React.useState(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params: { search, limit: 20 } });
      return data;
    },
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      toast.success('Empresa eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al eliminar empresa (¿Eres admin?)');
      setDeletingId(null);
    }
  });

  const companies = data?.data || [];

  const handleCreate = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  return (
    <div className="app-layout">

      <Topbar 
        title="Empresas" 
        subtitle={data?.pagination ? `${companies.length} empresas` : 'Cargando...'} 
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn--ghost" onClick={descargarPlantilla}>
              <FileDown size={16} /> Plantilla
            </button>
            <button className="btn btn--secondary" onClick={() => { setSelectedFile(null); setImportResult(null); setIsImportModalOpen(true); }}>
              <Upload size={16} /> Importar Excel
            </button>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} />
              Nueva empresa
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Buscar empresa o NIT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
          </div>
        ) : companies.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin empresas aún</h2>
            <p className="empty-state__desc">
              Crea tu primera empresa para comenzar a gestionar clientes logísticos.
            </p>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} />
              Crear empresa
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" className="custom-checkbox" /></th>
                  <th>Empresa</th>
                  <th>NIT</th>
                  <th>Ciudad</th>
                  <th>Contactos</th>
                  <th>Oportunidades</th>
                  <th>Responsable</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr key={company.id}>
                    <td><input type="checkbox" className="custom-checkbox" /></td>
                    <td>
                      <Link 
                        to={`/companies/${company.id}`} 
                        style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}
                        className="hover-link"
                      >
                        {company.name}
                      </Link>
                      {company.website && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{company.website}</div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{company.nit || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{company.city || '—'}</td>
                    <td>
                      <span className="badge badge--gray">{company.contacts_count || 0}</span>
                    </td>
                    <td>
                      <span className="badge badge--primary">{company.open_opportunities_count || 0}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {company.assigned_to_name || '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="btn btn--secondary btn--sm" 
                          onClick={() => handleEdit(company)}
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button 
                          className="btn btn--ghost btn--sm" 
                          style={{ color: 'var(--clr-danger)' }}
                          onClick={() => setDeletingId(company.id)}
                          title="Eliminar"
                        >
                          Eliminar
                        </button>
                        <Link to={`/companies/${company.id}`} className="btn btn--ghost btn--sm" title="Abrir">
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal 
          title={editingCompany ? "Editar Empresa" : "Agregar Nueva Empresa"} 
          onClose={() => setIsModalOpen(false)}
        >
          <CompanyForm 
            company={editingCompany}
            onSuccess={() => setIsModalOpen(false)} 
            onCancel={() => setIsModalOpen(false)} 
          />
        </Modal>
      )}

      {deletingId && (
        <Modal 
          title="Eliminar Empresa" 
          onClose={() => setDeletingId(null)}
          maxWidth="400px"
        >
          <p style={{ color: 'var(--text-secondary)' }}>
            ¿Estás seguro de que deseas eliminar esta empresa? Esta acción se reflejará en el sistema, aunque no eliminará los datos históricos permanentemente (soft delete).
          </p>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn btn--secondary" onClick={() => setDeletingId(null)}>
              Cancelar
            </button>
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

      {isImportModalOpen && (
        <Modal
          title="Importar Empresas desde Excel"
          onClose={() => { setIsImportModalOpen(false); setSelectedFile(null); setImportResult(null); }}
          maxWidth="640px"
        >
          {!importResult ? (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Selecciona un archivo Excel (.xlsx) con los datos de las empresas a importar.
                  Usa la plantilla de ejemplo para asegurar el formato correcto.
                </p>
                <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
                  <li>Máximo 500 filas por archivo</li>
                  <li>Las filas con errores se omiten sin detener el proceso</li>
                  <li>Los NIT duplicados se reportan como error sin interrumpir la importación</li>
                </ul>
              </div>

              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: selectedFile ? 'var(--bg-subtle)' : 'transparent',
                  transition: 'all 0.2s',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                    setSelectedFile(file);
                  } else {
                    toast.error('Solo se aceptan archivos .xlsx o .xls');
                  }
                }}
                onClick={() => document.getElementById('excel-file-input').click()}
              >
                <input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setSelectedFile(file);
                  }}
                />
                {selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <FileDown size={24} style={{ color: 'var(--clr-primary-500)' }} />
                    <div>
                      <p style={{ fontWeight: 600 }}>{selectedFile.name}</p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                    <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                      Haz clic o arrastra un archivo aquí
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      .xlsx o .xls (máx 5 MB)
                    </p>
                  </div>
                )}
              </div>

              <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
                <button className="btn btn--secondary" onClick={() => { setIsImportModalOpen(false); setSelectedFile(null); setImportResult(null); }}>
                  Cancelar
                </button>
                <button
                  className="btn btn--primary"
                  disabled={!selectedFile || isImporting}
                  onClick={async () => {
                    if (!selectedFile) return;
                    setIsImporting(true);
                    try {
                      const formData = new FormData();
                      formData.append('archivo', selectedFile);
                      const { data } = await api.post('/companies/import', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        timeout: 60000,
                      });
                      setImportResult(data.data);
                      queryClient.invalidateQueries({ queryKey: ['companies'] });
                      toast.success(`Importación completada: ${data.data.importadas} empresas creadas`);
                    } catch (err) {
                      const msg = err.response?.data?.error?.message || 'Error al procesar el archivo';
                      toast.error(msg);
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                >
                  {isImporting ? 'Procesando...' : 'Procesar Importación'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ─── Resultados ─── */}
              <div style={{ marginBottom: '1.5rem' }}>
                {/* Header del resumen */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '8px',
                    background: importResult.errores === 0 ? 'var(--clr-success-500)15' : 'var(--bg-subtle)',
                    border: `1px solid ${importResult.errores === 0 ? 'var(--clr-success-500)30' : 'var(--border-color)'}`,
                    textAlign: 'center',
                  }}>
                    <CheckCircle size={24} style={{ color: 'var(--clr-success-500)', marginBottom: '0.25rem' }} />
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--clr-success-500)' }}>{importResult.importadas}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Importadas</p>
                  </div>
                  <div style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '8px',
                    background: importResult.errores > 0 ? 'var(--clr-danger-500)15' : 'var(--bg-subtle)',
                    border: `1px solid ${importResult.errores > 0 ? 'var(--clr-danger-500)30' : 'var(--border-color)'}`,
                    textAlign: 'center',
                  }}>
                    <AlertTriangle size={24} style={{ color: importResult.errores > 0 ? 'var(--clr-danger-500)' : 'var(--text-muted)', marginBottom: '0.25rem' }} />
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: importResult.errores > 0 ? 'var(--clr-danger-500)' : 'var(--text-muted)' }}>{importResult.errores}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Errores</p>
                  </div>
                  <div style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '8px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center',
                  }}>
                    <AlertCircle size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }} />
                    <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{importResult.total}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total Filas</p>
                  </div>
                </div>

                {importResult.errores > 0 && (
                  <>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--clr-danger-500)' }} />
                      Detalle de errores por fila
                    </p>
                    <div style={{
                      maxHeight: '250px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                    }}>
                      <table style={{ width: '100%', fontSize: 'var(--text-xs)' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-subtle)' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Fila</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Empresa</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>NIT</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.detalle_errores.map((err, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{err.fila}</td>
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>{err.nombre}</td>
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>{err.nit}</td>
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--clr-danger-500)' }}>
                                {err.errores.join('; ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn--primary"
                  onClick={() => { setIsImportModalOpen(false); setSelectedFile(null); setImportResult(null); }}
                >
                  {importResult.importadas > 0 ? 'Cerrar y recargar lista' : 'Cerrar'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
