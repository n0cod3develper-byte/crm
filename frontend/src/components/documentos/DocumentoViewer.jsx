import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, File, FileText, ImageIcon } from 'lucide-react';
import { Modal } from '../common/Modal';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

export function DocumentoViewer({ documento, onClose }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!documento) return;
    let objectUrl = '';
    const fetchBlob = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/documentos/${documento.id}/ver`, { responseType: 'blob' });
        objectUrl = URL.createObjectURL(new Blob([res.data]));
        setBlobUrl(objectUrl);
      } catch (err) {
        toast.error('Error al cargar la previsualización');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBlob();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documento]);

  const handleDownload = async () => {
    try {
      toast.loading('Descargando...', { id: 'descarga' });
      const res = await api.get(`/documentos/${documento.id}/descargar`, { responseType: 'blob' });
      
      const contentType = res.headers['content-type'] || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
      
      const link = document.createElement('a');
      link.href = url;
      
      // Asegurar extensión correcta en el nombre de descarga
      const ext = documento.formato?.toLowerCase() || 'bin';
      let fileName = documento.nombre_display || 'documento';
      if (!fileName.toLowerCase().endsWith(`.${ext}`)) {
        fileName = `${fileName}.${ext}`;
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Descarga completada', { id: 'descarga' });
    } catch (err) {
      toast.error('Error al descargar el documento', { id: 'descarga' });
    }
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };
  if (!documento) return null;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          <div className="spinner" style={{ width: '2rem', height: '2rem', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Cargando previsualización...</p>
        </div>
      );
    }

    const esImagen = documento.mime_type && documento.mime_type.startsWith('image/');
    const esPDF = documento.mime_type === 'application/pdf';

    if (documento.es_visualizable_inline) {
      if (esPDF) {
        return (
          <iframe 
            src={blobUrl} 
            title={documento.nombre_display}
            style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none', borderRadius: 'var(--radius-md)', background: '#fff' }}
          >
            <p>Tu navegador no puede mostrar PDF inline. <button onClick={handleDownload} className="text-primary hover:underline">Descárgalo aquí</button></p>
          </iframe>
        );
      } else if (esImagen) {
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <img 
              src={blobUrl} 
              alt={documento.nombre_display} 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        );
      }
    }

    // Default: Not viewable inline or format fallback
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', gap: '1rem' }}>
        <File size={64} style={{ color: 'var(--text-muted)' }} />
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{documento.nombre_display}</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Previsualización no disponible para este formato.</p>
        <button onClick={handleDownload} className="btn btn--primary mt-4">
          <Download size={16} /> Descargar Archivo
        </button>
      </div>
    );
  };

  const getIcon = () => {
    if (documento.mime_type === 'application/pdf') return <FileText size={18} className="text-danger" />;
    if (documento.mime_type && documento.mime_type.startsWith('image/')) return <ImageIcon size={18} className="text-primary" />;
    return <File size={18} className="text-secondary" />;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem 1.5rem', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {getIcon()}
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {documento.nombre_display}
            </h2>
            <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>{documento.tipo_nombre || 'Sin tipo'}</span>
              <span>Subido por: {documento.subido_por_nombre || 'Usuario'}</span>
              <span>{(documento.tamano_bytes / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleDownload} className="btn btn--secondary btn--sm">
            <Download size={16} /> <span className="hidden sm:inline">Descargar</span>
          </button>
          <button onClick={handleOpenNewTab} className="btn btn--secondary btn--sm" title="Abrir en nueva pestaña" disabled={!blobUrl}>
            <ExternalLink size={16} />
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ marginLeft: '1rem' }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '1.5rem', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: '100%' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
