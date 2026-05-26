import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthStore } from '../../stores/authStore';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import {
  User, Mail, Lock, Camera, Save, CheckCircle, Loader2, Upload,
  Shield, AtSign, Eye, EyeOff
} from 'lucide-react';

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const qc = useQueryClient();
  const fileInputRef = useRef(null);

  // ─── Formulario de datos personales ────────────────────
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');

  // ─── Formulario de cambio de contraseña ────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ─── Foto de perfil ────────────────────────────────────
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Sincronizar datos del usuario
  useEffect(() => {
    if (authUser) {
      setNombre(authUser.nombre || '');
      setApellido(authUser.apellido || '');
    }
  }, [authUser]);

  // ─── Cargar datos frescos del perfil ──────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['perfil'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    },
    enabled: !!authUser,
  });

  const user = profile || authUser;

  // ─── Mutación: actualizar datos personales ────────────
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.patch('/auth/me', data);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success('Datos actualizados correctamente');
      if (res.data) {
        // Actualizar AuthContext
        setUser({ ...authUser, ...res.data });
      }
      qc.invalidateQueries({ queryKey: ['perfil'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al actualizar datos');
    },
  });

  // ─── Mutación: cambiar contraseña ──────────────────────
  const passwordMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/auth/me/password', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Contraseña cambiada exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al cambiar contraseña');
    },
  });

  // ─── Subir foto de perfil ──────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo y tamaño
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Usa JPG, PNG, WebP o GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    // Vista previa
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('documento', file);
      const res = await api.post('/auth/me/foto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.data) {
        setUser({ ...authUser, avatar_url: res.data.data.avatar_url });
        setPhotoPreview(null);
        toast.success('Foto de perfil actualizada');
      }
      qc.invalidateQueries({ queryKey: ['perfil'] });
    } catch (err) {
      setPhotoPreview(null);
      toast.error(err.response?.data?.error || 'Error al subir foto');
    } finally {
      setUploading(false);
    }
  };

  // ─── Guardar datos personales ─────────────────────────
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!nombre.trim() && !apellido.trim()) {
      toast.error('Debes ingresar al menos un nombre');
      return;
    }
    updateMutation.mutate({ nombre: nombre.trim(), apellido: apellido.trim() });
  };

  // ─── Guardar contraseña ───────────────────────────────
  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Todos los campos son obligatorios');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  // ─── Determinar foto a mostrar ────────────────────────
  const displayPhoto = photoPreview || user?.avatar_url || null;
  const initials = user?.nombre?.[0]?.toUpperCase?.() || user?.email?.[0]?.toUpperCase?.() || '?';

  return (
    <Layout
      title="Mi Perfil"
      subtitle="Administra tu información personal y seguridad"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 800, margin: '0 auto' }}>

        {/* ════════════════════════════════════════════════
            SECCIÓN 1: Foto de Perfil
           ════════════════════════════════════════════════ */}
        <div className="card" style={{ position: 'relative', overflow: 'visible' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={18} /> Foto de Perfil
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt="Foto de perfil"
                  style={{
                    width: 96, height: 96, borderRadius: '50%', objectFit: 'cover',
                    border: '3px solid var(--clr-primary-500)', boxShadow: 'var(--shadow-md)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, fontWeight: 800, color: 'white',
                    border: '3px solid var(--clr-primary-500)', boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {initials}
                </div>
              )}

              {/* Botón de subir foto */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  position: 'absolute', bottom: 0, right: -4,
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--clr-primary-500)', color: 'white',
                  border: '3px solid var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: 'var(--shadow-md)',
                }}
                title="Cambiar foto"
              >
                {uploading ? (
                  <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <Upload size={16} />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                {user?.nombre} {user?.apellido}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={13} /> {user?.email}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Shield size={13} /> Rol: {user?.rol_nombre || 'Sin asignar'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                JPG, PNG, WebP o GIF · Máx 5MB
              </span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            SECCIÓN 2: Datos Personales
           ════════════════════════════════════════════════ */}
        <div className="card" style={{ position: 'relative', overflow: 'visible' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} /> Datos Personales
          </h3>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Email (solo lectura) */}
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AtSign size={14} /> Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  value={user?.email || ''}
                  disabled
                  style={{
                    opacity: 0.6, cursor: 'not-allowed',
                    background: 'var(--bg-app)',
                  }}
                />
                <span
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500,
                    background: 'var(--bg-elevated)', padding: '0.15rem 0.4rem', borderRadius: 4,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  No modificable
                </span>
              </div>
            </div>

            {/* Nombre y Apellido */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Nombre(s)</label>
                <input
                  className="input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Apellido(s)</label>
                <input
                  className="input"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <Save size={16} />
                )}
                {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>

        {/* ════════════════════════════════════════════════
            SECCIÓN 3: Cambiar Contraseña
           ════════════════════════════════════════════════ */}
        <div className="card" style={{ position: 'relative', overflow: 'visible' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={18} /> Cambiar Contraseña
          </h3>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Contraseña actual */}
            <div className="input-group">
              <label className="input-label">Contraseña Actual</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: '0.25rem', display: 'flex',
                  }}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Nueva contraseña */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Nueva Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    autoComplete="new-password"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', padding: '0.25rem', display: 'flex',
                    }}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Confirmar Nueva Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                    style={{
                      paddingRight: '2.5rem',
                      borderColor: confirmPassword && newPassword !== confirmPassword ? 'var(--clr-danger)' : undefined,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', padding: '0.25rem', display: 'flex',
                    }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <span className="input-error">Las contraseñas no coinciden</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? (
                  <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <CheckCircle size={16} />
                )}
                {passwordMutation.isPending ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </Layout>
  );
}
