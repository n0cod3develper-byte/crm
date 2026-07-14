import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, Filter, Shield, Copy, Check, AlertCircle, Key, Eye, EyeOff, Link, Unlink, UserCheck, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rolFilter, setRolFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', rol_id: '' });
  const [inviting, setInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Vinculación empleado-usuario
  const [employees, setEmployees] = useState([]);
  const [linkModalUser, setLinkModalUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [linkingEmployee, setLinkingEmployee] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

  useEffect(() => {
    fetchData();
  }, [searchTerm, rolFilter]);

  async function fetchData() {
    try {
      const [usersRes, rolesRes, employeesRes] = await Promise.all([
        fetch(`${API_URL}/admin/usuarios?q=${searchTerm}&rol=${rolFilter}`, {
          credentials: 'include'
        }),
        fetch(`${API_URL}/admin/roles`, {
          credentials: 'include'
        }),
        fetch(`${API_URL}/employees?limit=200`, {
          credentials: 'include'
        })
      ]);

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      const employeesData = await employeesRes.json();

      setUsuarios(usersData.data);
      setRoles(rolesData.data || rolesData || []);
      setEmployees(employeesData.data || []);
    } catch (err) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  }

  // Encontrar empleado vinculado a un usuario
  function getEmployeeForUser(userId) {
    return employees.find(e => e.user_id === userId);
  }

  // Vincular un empleado a un usuario
  async function handleLinkEmployee(userId) {
    if (!selectedEmployeeId) {
      toast.error('Selecciona un empleado para vincular');
      return;
    }
    setLinkingEmployee(true);
    try {
      // Desvincular empleado anterior si lo hay
      const currentEmp = getEmployeeForUser(userId);
      if (currentEmp) {
        await fetch(`${API_URL}/employees/${currentEmp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ user_id: null })
        });
      }

      await fetch(`${API_URL}/employees/${selectedEmployeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId })
      });

      toast.success('Empleado vinculado correctamente');
      setLinkModalUser(null);
      setSelectedEmployeeId('');
      fetchData();
    } catch (err) {
      toast.error('Error al vincular empleado');
    } finally {
      setLinkingEmployee(false);
    }
  }

  // Desvincular empleado de un usuario
  async function handleUnlinkEmployee(employeeId) {
    if (!window.confirm('¿Desvincular este empleado del usuario?')) return;
    try {
      await fetch(`${API_URL}/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: null })
      });
      toast.success('Empleado desvinculado');
      fetchData();
    } catch (err) {
      toast.error('Error al desvincular');
    }
  }

  async function cambiarRol(targetUserId, rolId) {
    try {
      const res = await fetch(`${API_URL}/admin/usuarios/${targetUserId}/rol`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          rol_id: rolId,
          ejecutado_por: currentUser.id
        })
      });

      if (res.ok) {
        toast.success('Rol actualizado correctamente');
        fetchData();
        setSelectedUser(null);
      }
    } catch (err) {
      toast.error('Error al actualizar rol');
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteData.email || !inviteData.rol_id) {
      return toast.error('Completa todos los campos');
    }

    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/admin/usuarios/invitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(inviteData)
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedLink(data.invitationLink);
        toast.success('Invitación generada');
      } else {
        toast.error(data.error || 'Error al generar invitación');
      }
    } catch (err) {
      toast.error('Error de red');
    } finally {
      setInviting(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedLink);
    toast.success('Enlace copiado al portapapeles');
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('Las contraseñas no coinciden');
    }
    if (newPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres');
    }

    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/admin/usuarios/${passwordChangeUser.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          password: newPassword,
          ejecutado_por: currentUser.id
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Contraseña actualizada correctamente');
        setPasswordChangeUser(null);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error?.message || data.error || 'Error al cambiar la contraseña');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setChangingPassword(false);
    }
  }

  const getRolBadgeColor = (slug) => {
    const config = {
      admin: 'badge--danger',
      supervisor_mant: 'badge--primary',
      tecnico: 'badge--success',
      almacenista: 'badge--warning',
      comprador: 'badge--primary'
    };
    return config[slug] || 'badge--gray';
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Gestión de Usuarios" 
        subtitle="Asigna roles y gestiona el acceso de los empleados"
        rightContent={
          <button className="btn btn--primary" onClick={() => {
            setGeneratedLink('');
            setShowInviteModal(true);
          }}>
            <Users size={18} /> Invitar Usuario
          </button>
        }
      />
      <main className="main-content">
        <div className="card mb-6 flex flex-col md:flex-row gap-4">
        <div className="input-group flex-1">
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..." 
              className="input" 
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="input-group" style={{ minWidth: '200px' }}>
          <div style={{ position: 'relative' }}>
            <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <select 
              className="input" 
              style={{ paddingLeft: '2.5rem' }}
              value={rolFilter}
              onChange={(e) => setRolFilter(e.target.value)}
            >
              <option value="">Todos los roles</option>
              {roles.map(r => <option key={r.id} value={r.slug}>{r.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Empleado Vinculado</th>
              <th>Estado</th>
              <th>Último Acceso</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>Cargando usuarios...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>No se encontraron usuarios</td></tr>
            ) : (
              usuarios.map(u => {
                const emp = getEmployeeForUser(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div style={{ 
                          width: 32, height: 32, borderRadius: '50%', 
                          background: 'var(--bg-elevated)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700
                        }}>
                          {u.nombre?.[0]}{u.apellido?.[0]}
                        </div>
                        <span className="font-semibold">{u.nombre} {u.apellido}</span>
                      </div>
                    </td>
                    <td><span className="text-muted">{u.email}</span></td>
                    <td>
                      <span className={`badge ${getRolBadgeColor(u.rol_slug)}`}>
                        {u.rol_nombre || 'Sin Rol'}
                      </span>
                    </td>
                    <td>
                      {emp ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: 'var(--text-xs)',
                        }}>
                          <UserCheck size={14} style={{ color: 'var(--clr-success)', flexShrink: 0 }} />
                          <span>
                            {emp.full_name}
                            <span style={{ color: 'var(--text-muted)' }}> — {emp.position}</span>
                          </span>
                          <button
                            onClick={() => handleUnlinkEmployee(emp.id)}
                            className="btn btn--ghost btn--sm"
                            style={{
                              color: 'var(--text-muted)',
                              padding: '2px 6px',
                              minHeight: 'unset',
                              fontSize: '10px',
                            }}
                            title="Desvincular"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}>
                          <Unlink size={12} />
                          Sin empleado
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.estado === 'ACTIVO' ? 'badge--success' : 'badge--danger'}`}>
                        {u.estado}
                      </span>
                    </td>
                    <td><span className="text-xs text-muted">{u.updated_at ? new Date(u.updated_at).toLocaleDateString() : 'Nunca'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                        <button className="btn btn--ghost btn--sm" onClick={() => setSelectedUser(u)}>
                          <Shield size={13} /> Rol
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={() => {
                          setLinkModalUser(u);
                          setSelectedEmployeeId(emp?.id || '');
                        }}>
                          <Link size={13} /> {emp ? 'Cambiar' : 'Vincular'}
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={() => {
                          setPasswordChangeUser(u);
                          setNewPassword('');
                          setConfirmPassword('');
                          setShowNewPassword(false);
                        }}>
                          <Key size={13} /> Clave
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h3 className="font-bold">Gestionar Acceso</h3>
            </div>
            <div className="modal__body">
              <div className="flex items-center gap-4 mb-4">
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--clr-primary-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {selectedUser.nombre?.[0]}{selectedUser.apellido?.[0]}
                </div>
                <div>
                  <div className="font-bold">{selectedUser.nombre} {selectedUser.apellido}</div>
                  <div className="text-xs text-muted">{selectedUser.email}</div>
                </div>
              </div>
              
              <div className="input-group">
                <label className="input-label">Seleccionar nuevo rol</label>
                <select 
                  className="input" 
                  defaultValue={selectedUser.rol_id}
                  onChange={(e) => cambiarRol(selectedUser.id, e.target.value)}
                >
                  <option value="">Selecciona un rol...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setSelectedUser(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {passwordChangeUser && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h3 className="font-bold">Cambiar Contraseña</h3>
              <p className="text-xs text-muted">Establece una nueva contraseña para el usuario</p>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className="modal__body flex flex-col gap-4">
                <div className="flex items-center gap-4 mb-2">
                  <div style={{ 
                    width: 48, height: 48, borderRadius: '50%', 
                    background: 'var(--clr-primary-500)', color: 'white', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontWeight: 700 
                  }}>
                    {passwordChangeUser.nombre?.[0]}{passwordChangeUser.apellido?.[0]}
                  </div>
                  <div>
                    <div className="font-bold">{passwordChangeUser.nombre} {passwordChangeUser.apellido}</div>
                    <div className="text-xs text-muted">{passwordChangeUser.email}</div>
                  </div>
                </div>
                
                <div className="input-group">
                  <label className="input-label">Nueva Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showNewPassword ? 'text' : 'password'} 
                      className="input" 
                      placeholder="Mínimo 6 caracteres"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ 
                        position: 'absolute', right: '12px', top: '50%', 
                        transform: 'translateY(-50%)', background: 'none', 
                        border: 'none', color: 'var(--text-muted)', cursor: 'pointer' 
                      }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Confirmar Contraseña</label>
                  <input 
                    type={showNewPassword ? 'text' : 'password'} 
                    className="input" 
                    placeholder="Repite la nueva contraseña"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal__footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--secondary" onClick={() => {
                  setPasswordChangeUser(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}>Cancelar</button>
                <button type="submit" className="btn btn--primary" disabled={changingPassword}>
                  {changingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal__header">
              <h3 className="font-bold">Invitar Nuevo Usuario</h3>
              <p className="text-xs text-muted">Genera un enlace de activación para el empleado</p>
            </div>
            
            {!generatedLink ? (
              <form onSubmit={handleInvite}>
                <div className="modal__body flex flex-col gap-4">
                  <div className="input-group">
                    <label className="input-label">Correo Electrónico</label>
                    <input 
                      type="email" 
                      className="input" 
                      placeholder="ejemplo@empresa.com"
                      required
                      value={inviteData.email}
                      onChange={e => setInviteData({...inviteData, email: e.target.value})}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Rol Inicial</label>
                    <select 
                      className="input" 
                      required
                      value={inviteData.rol_id}
                      onChange={e => setInviteData({...inviteData, rol_id: e.target.value})}
                    >
                      <option value="">Selecciona un rol...</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    <Shield size={14} style={{ marginBottom: '4px', color: 'var(--clr-primary-500)' }} />
                    <p>Al generar la invitación, el sistema creará un token seguro de 48 horas. Deberás copiar el enlace y enviárselo al usuario.</p>
                  </div>
                </div>
                <div className="modal__footer">
                  <button type="button" className="btn btn--secondary" onClick={() => setShowInviteModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn--primary" disabled={inviting}>
                    {inviting ? 'Generando...' : 'Generar Enlace'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal__body flex flex-col gap-4">
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--clr-success-500)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <Check size={24} />
                  </div>
                  <h4 className="font-bold">¡Enlace Generado!</h4>
                  <p className="text-sm text-muted">Envía este enlace al usuario para que active su cuenta.</p>
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="input" 
                      readOnly 
                      value={generatedLink} 
                      style={{ background: 'var(--bg-elevated)', fontSize: '12px' }}
                    />
                    <button className="btn btn--primary" onClick={copyToClipboard}>
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.2)', borderRadius: 'var(--radius-md)' }}>
                  <AlertCircle size={20} style={{ color: '#ffc107', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Este enlace es de uso único y expirará en 48 horas por seguridad.
                  </p>
                </div>

                <div className="modal__footer">
                  <button className="btn btn--secondary" style={{ width: '100%' }} onClick={() => setShowInviteModal(false)}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: Vincular empleado a usuario ───────────────── */}
      {linkModalUser && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal__header">
              <h3 className="font-bold">Vincular Empleado</h3>
              <p className="text-xs text-muted">Asocia una ficha de empleado a la cuenta de usuario</p>
            </div>
            <div className="modal__body flex flex-col gap-4">
              <div className="flex items-center gap-4 mb-2">
                <div style={{ 
                  width: 48, height: 48, borderRadius: '50%', 
                  background: 'var(--clr-primary-500)', color: 'white', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 700 
                }}>
                  {linkModalUser.nombre?.[0]}{linkModalUser.apellido?.[0]}
                </div>
                <div>
                  <div className="font-bold">{linkModalUser.nombre} {linkModalUser.apellido}</div>
                  <div className="text-xs text-muted">{linkModalUser.email}</div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">
                  <Link size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Seleccionar empleado
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">— Selecciona un empleado —</option>
                  {employees
                    .filter(e => !e.user_id || e.user_id === linkModalUser.id)
                    .map(e => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} — {e.position} {e.user_id ? '(vinculado actual)' : ''}
                      </option>
                    ))}
                </select>
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>
                  Solo se muestran empleados sin vincular o el actualmente vinculado.
                </p>
              </div>
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => { setLinkModalUser(null); setSelectedEmployeeId(''); }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!selectedEmployeeId || linkingEmployee}
                onClick={() => handleLinkEmployee(linkModalUser.id)}
              >
                {linkingEmployee ? 'Vinculando...' : 'Vincular Empleado'}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}
