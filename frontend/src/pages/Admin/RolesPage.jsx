import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Save, RotateCcw, Info, Users, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { rolesService } from '../../services/rolesService';
import { RolFormModal } from './RolFormModal';

const ACCIONES = [
  { slug: 'puede_ver', label: 'Ver', icon: 'Eye' },
  { slug: 'puede_crear', label: 'Crear', icon: 'PlusSquare' },
  { slug: 'puede_editar', label: 'Editar', icon: 'Edit' },
  { slug: 'puede_eliminar', label: 'Eliminar', icon: 'Trash2' },
  { slug: 'puede_exportar', label: 'Exportar', icon: 'Download' },
  { slug: 'puede_aprobar', label: 'Aprobar', icon: 'CheckCircle' },
  { slug: 'puede_liquidar', label: 'Liquidar', icon: 'Zap' },
];

export function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [rolSeleccionado, setRolSeleccionado] = useState(null);
  const [matriz, setMatriz] = useState([]); // Matriz de permisos del rol seleccionado
  const [originalMatriz, setOriginalMatriz] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [rolToEdit, setRolToEdit] = useState(null);

  useEffect(() => {
    cargarRoles();
  }, []);

  async function cargarRoles(selectId = null) {
    try {
      const data = await rolesService.fetchRoles();
      setRoles(data);
      if (data.length > 0) {
        if (selectId) {
          const rol = data.find(r => r.id === selectId);
          if (rol) seleccionarRol(rol);
        } else if (!rolSeleccionado) {
          seleccionarRol(data[0]);
        } else {
          // Refrescar el rol seleccionado si ya había uno
          const rol = data.find(r => r.id === rolSeleccionado.id);
          if (rol) seleccionarRol(rol);
        }
      } else {
        setRolSeleccionado(null);
        setMatriz([]);
      }
    } catch (err) {
      toast.error('Error cargando roles');
    } finally {
      setLoading(false);
    }
  }

  async function seleccionarRol(rol) {
    setRolSeleccionado(rol);
    try {
      const data = await rolesService.fetchRolDetalle(rol.id);
      setMatriz(data.permisos);
      setOriginalMatriz(JSON.parse(JSON.stringify(data.permisos)));
    } catch (err) {
      toast.error('Error cargando permisos del rol');
    }
  }

  const handleToggle = (moduloSlug, accionSlug) => {
    setMatriz(prev => prev.map(row => {
      if (row.modulo_slug !== moduloSlug) return row;

      const newValue = !row[accionSlug];
      const newRow = { ...row, [accionSlug]: newValue };

      if (accionSlug !== 'puede_ver' && newValue) {
        newRow.puede_ver = true;
      }
      if (accionSlug === 'puede_ver' && !newValue) {
        ACCIONES.forEach(a => newRow[a.slug] = false);
      }

      return newRow;
    }));
  };

  const hayCambios = JSON.stringify(matriz) !== JSON.stringify(originalMatriz);

  async function guardarCambios() {
    if (!rolSeleccionado) return;
    setSaving(true);
    try {
      await rolesService.guardarPermisos(rolSeleccionado.id, matriz, user.id);
      toast.success('Permisos actualizados correctamente');
      setOriginalMatriz(JSON.parse(JSON.stringify(matriz)));
    } catch (err) {
      toast.error('Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  }

  const handleCrearRol = () => {
    setRolToEdit(null);
    setShowModal(true);
  };

  const handleEditarRol = (rol) => {
    setRolToEdit(rol);
    setShowModal(true);
  };

  const handleEliminarRol = async (rol) => {
    if (rol.es_sistema) {
      toast.error('No se puede eliminar un rol del sistema');
      return;
    }
    if (rol.total_usuarios > 0) {
      toast.error(`No se puede eliminar porque tiene ${rol.total_usuarios} usuarios asignados`);
      return;
    }
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el rol "${rol.nombre}"?`)) {
      return;
    }

    try {
      await rolesService.eliminarRol(rol.id);
      toast.success('Rol eliminado correctamente');
      if (rolSeleccionado?.id === rol.id) {
        setRolSeleccionado(null);
      }
      cargarRoles();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar el rol');
    }
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    cargarRoles(); // Recargar la lista después de crear o editar
  };

  if (loading) return (
    <div className="app-layout">
      <div className="main-content flex items-center justify-center">Cargando...</div>
    </div>
  );

  return (
    <div className="app-layout">
      <Topbar 
        title="Gestión de Roles y Permisos" 
        subtitle="Administra qué puede hacer cada perfil en el sistema"
      />
      <main className="main-content">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Panel Izquierdo: Lista de Roles */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users size={16} /> Roles del Sistema
            </h2>
            <button className="btn btn--primary btn--sm flex items-center gap-1" onClick={handleCrearRol}>
              <Plus size={14} /> Nuevo
            </button>
          </div>
          <div className="flex flex-col">
            {roles.map(rol => (
              <div 
                key={rol.id}
                className={`nav-item ${rolSeleccionado?.id === rol.id ? 'nav-item--active' : ''}`}
                style={{ 
                  borderRadius: 0, 
                  borderBottom: '1px solid var(--border-subtle)',
                  background: rolSeleccionado?.id === rol.id ? 'var(--clr-primary-50)' : 'transparent',
                  color: rolSeleccionado?.id === rol.id ? 'var(--clr-primary-600)' : 'var(--text-primary)'
                }}
              >
                <div 
                  className="flex-1 p-4 cursor-pointer flex justify-between items-center"
                  onClick={() => seleccionarRol(rol)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{rol.nombre}</span>
                    <span className="text-xs opacity-70">{rol.total_usuarios || 0} usuarios</span>
                  </div>
                  <ChevronRight size={16} opacity={0.5} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Derecho: Matriz de Permisos */}
        <div className="flex flex-col gap-4">
          {rolSeleccionado && (
            <div className="card" style={{ position: 'relative' }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    {rolSeleccionado.nombre}
                    {rolSeleccionado.es_sistema && (
                      <span className="badge badge--primary">Rol de Sistema</span>
                    )}
                  </h3>
                  <p className="text-sm text-muted mt-1">{rolSeleccionado.descripcion || 'Sin descripción'}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    className="btn btn--secondary btn--sm flex items-center gap-1"
                    onClick={() => handleEditarRol(rolSeleccionado)}
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  {!rolSeleccionado.es_sistema && (
                    <button 
                      className="btn btn--danger btn--sm flex items-center gap-1"
                      onClick={() => handleEliminarRol(rolSeleccionado)}
                      title={rolSeleccionado.total_usuarios > 0 ? "No se puede eliminar un rol con usuarios" : "Eliminar rol"}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  )}
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '250px' }}>Módulo</th>
                      {ACCIONES.map(a => (
                        <th key={a.slug} style={{ textAlign: 'center' }}>
                          <div className="flex flex-col items-center gap-1">
                            <span style={{ fontSize: '10px' }}>{a.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matriz.map(row => (
                      <tr key={row.modulo_slug}>
                        <td className="font-semibold">{row.modulo_nombre}</td>
                        {ACCIONES.map(a => (
                          <td key={a.slug} style={{ textAlign: 'center' }}>
                            <label className="switch-container" style={{ display: 'inline-block', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={row[a.slug] || false}
                                onChange={() => handleToggle(row.modulo_slug, a.slug)}
                                className="sr-only"
                              />
                              <div style={{
                                width: '36px',
                                height: '20px',
                                background: row[a.slug] ? 'var(--clr-primary-500)' : 'var(--clr-gray-300)',
                                borderRadius: '10px',
                                position: 'relative',
                                transition: 'all 0.2s'
                              }}>
                                <div style={{
                                  width: '14px',
                                  height: '14px',
                                  background: 'white',
                                  borderRadius: '50%',
                                  position: 'absolute',
                                  top: '3px',
                                  left: row[a.slug] ? '19px' : '3px',
                                  transition: 'all 0.2s'
                                }} />
                              </div>
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hayCambios && (
                <div style={{
                  marginTop: '2rem',
                  padding: '1rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--clr-primary-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  animation: 'slideUp 0.3s ease'
                }}>
                  <div className="flex items-center gap-2 text-sm text-primary-600 font-semibold">
                    <Info size={16} /> Tienes cambios sin guardar
                  </div>
                  <div className="flex gap-3">
                    <button 
                      className="btn btn--secondary" 
                      onClick={() => setMatriz(JSON.parse(JSON.stringify(originalMatriz)))}
                    >
                      <RotateCcw size={16} /> Descartar
                    </button>
                    <button 
                      className="btn btn--primary" 
                      onClick={guardarCambios}
                      disabled={saving}
                    >
                      <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </main>

      {showModal && (
        <RolFormModal 
          onClose={() => setShowModal(false)} 
          onSuccess={handleModalSuccess} 
          rolToEdit={rolToEdit} 
        />
      )}
    </div>
  );
}
