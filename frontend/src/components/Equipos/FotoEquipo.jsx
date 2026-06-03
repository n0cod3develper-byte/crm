import React, { useState } from 'react';
import { Camera, Trash2, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

export function FotoEquipo({ equipoId, currentFotoUrl, onUploadSuccess, onDeleteSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());

  // Construir URL con timestamp para evitar cache
  const imageUrl = currentFotoUrl 
    ? `${currentFotoUrl}${currentFotoUrl.includes('?') ? '&' : '?'}t=${timestamp}`
    : `/api/v1/equipos/${equipoId}/foto?t=${timestamp}`;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validación del formato
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('El formato debe ser JPG, PNG o WEBP');
      return;
    }

    // Validación del tamaño (< 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('La imagen no debe superar los 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('foto', file);

    setUploading(true);
    const loadingToast = toast.loading('Subiendo imagen...');

    try {
      const { data } = await api.post(`/equipos/${equipoId}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Foto actualizada con éxito', { id: loadingToast });
      setTimestamp(Date.now());
      if (onUploadSuccess) onUploadSuccess(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al subir la imagen', { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar la foto de este equipo?')) {
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading('Eliminando imagen...');

    try {
      await api.delete(`/equipos/${equipoId}/foto`);
      toast.success('Foto eliminada con éxito', { id: loadingToast });
      setTimestamp(Date.now());
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar la imagen', { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem',
      width: '100%',
      maxWidth: '300px',
      margin: '0 auto'
    }}>
      {/* Contenedor de la Imagen */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '75%', // Relación de aspecto 4:3
        borderRadius: 'var(--radius-lg)',
        border: '2px dashed var(--border-color)',
        overflow: 'hidden',
        background: 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease-in-out'
      }}>
        {/* Foto o Placeholder */}
        <img
          src={imageUrl}
          alt="Foto del equipo"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: uploading ? 0.5 : 1,
            transition: 'opacity 0.2s ease'
          }}
          onError={(e) => {
            // La API ya maneja la visualización de un SVG placeholder si falla o falta.
          }}
        />

        {/* Spinner durante carga */}
        {uploading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
            color: '#ffffff',
            borderRadius: 'var(--radius-lg)'
          }}>
            <Loader className="spinner" size={32} />
          </div>
        )}
      </div>

      {/* Controles de Carga */}
      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
        <label 
          className="btn btn--primary" 
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '0.5rem', 
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-xs)',
            padding: '0.5rem 0.75rem'
          }}
        >
          <Camera size={14} />
          Subir Foto
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            disabled={uploading} 
            style={{ display: 'none' }} 
          />
        </label>

        {currentFotoUrl && (
          <button 
            type="button" 
            className="btn btn--danger" 
            onClick={handleDelete}
            disabled={uploading}
            style={{ 
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Eliminar Foto"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
