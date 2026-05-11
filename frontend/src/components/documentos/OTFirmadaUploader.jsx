import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, CheckCircle, FileText, AlertTriangle, Eye, RotateCcw } from 'lucide-react';
import api from '../../lib/api';
import { DocumentoViewer } from './DocumentoViewer';

export function OTFirmadaUploader({ otId, otConsecutivo, otFirmadaActual, onUploadSuccess, puedeSubir = true }) {
  const [uploading, setUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      return toast.error('Solo se permite subir archivos PDF para la OT firmada');
    }

    if (file.size > 10 * 1024 * 1024) {
      return toast.error('El archivo no puede pesar más de 10MB');
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('documento', file);

    try {
      const { data } = await api.post(`/documentos/ot/${otId}/firmada`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('OT firmada subida correctamente. Liquidación habilitada.');
      queryClient.invalidateQueries({ queryKey: ['ot', otId] });
      queryClient.invalidateQueries({ queryKey: ['ot-puede-liquidar', otId] });
      onUploadSuccess?.(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir la OT firmada');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (otFirmadaActual) {
    return (
      <>
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem'
        }}>
          <div className="flex items-center gap-3">
            <div style={{ background: 'var(--clr-success)', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <h4 style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--clr-success)' }}>
                OT firmada subida correctamente
              </h4>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                La liquidación de la orden {otConsecutivo} está habilitada.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="btn btn--secondary btn--sm bg-white" onClick={() => setViewingDoc(true)}>
              <Eye size={16} /> Ver Documento
            </button>
            {puedeSubir && (
              <button 
                className="btn btn--ghost btn--sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Reemplazar archivo"
              >
                {uploading ? <div className="spinner" style={{ width: 14, height: 14 }}/> : <RotateCcw size={16} />}
              </button>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" style={{ display: 'none' }} />
        </div>

        {viewingDoc && <DocumentoViewer documento={otFirmadaActual} onClose={() => setViewingDoc(false)} />}
      </>
    );
  }

  return (
    <div style={{
      background: 'rgba(245, 158, 11, 0.05)',
      border: '1px dashed rgba(245, 158, 11, 0.4)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      textAlign: 'center'
    }}>
      <div className="flex justify-center mb-3 text-warning">
        <AlertTriangle size={32} />
      </div>
      <h4 style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: '0.5rem' }}>
        Requerido para liquidar
      </h4>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 1.25rem' }}>
        Sube la orden de trabajo <strong>{otConsecutivo}</strong> firmada por el cliente en formato PDF para habilitar el proceso de liquidación.
      </p>

      {puedeSubir ? (
        <>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" style={{ display: 'none' }} />
          <button 
            className="btn btn--primary" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ background: 'var(--clr-warning)', borderColor: 'var(--clr-warning)', color: '#000' }}
          >
            {uploading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#000' }}/> Subiendo...</>
            ) : (
              <><UploadCloud size={18} /> Subir OT Firmada (PDF)</>
            )}
          </button>
        </>
      ) : (
        <div className="badge badge--gray mt-2">No tienes permiso para subir documentos</div>
      )}
    </div>
  );
}
