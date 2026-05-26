import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { File, FileText, Image as ImageIcon, Trash2, Eye, Download, AlertCircle, FilePlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import { DocumentoViewer } from './DocumentoViewer';

export function DocumentosList({ entidadTipo, entidadId, soloLectura = false }) {
  const [viewingDoc, setViewingDoc] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['documentos', entidadTipo, entidadId],
    queryFn: async () => {
      const res = await api.get(`/documentos/entidad/${entidadTipo}/${entidadId}`);
      return res.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/documentos/${id}`),
    onSuccess: () => {
      toast.success('Documento eliminado');
      queryClient.invalidateQueries({ queryKey: ['documentos', entidadTipo, entidadId] });
      queryClient.invalidateQueries({ queryKey: ['documentos-completitud'] });
    },
    onError: () => toast.error('Error al eliminar el documento')
  });

  if (isLoading) return <div className="spinner" style={{ margin: '2rem auto' }} />;

  const grupos = data?.grupos || [];
  const total = data?.total || 0;

  if (total === 0) {
    return (
      <div className="empty-state" style={{ padding: '3rem 1rem' }}>
        <FilePlus size={48} className="empty-state__icon text-muted" />
        <h3 className="empty-state__title mt-4">Sin documentos</h3>
        <p className="empty-state__desc">No hay documentos registrados para esta entidad.</p>
      </div>
    );
  }

  const getIcon = (doc) => {
    if (doc.mime_type === 'application/pdf') return <FileText size={18} className="text-danger" />;
    if (doc.mime_type && doc.mime_type.startsWith('image/')) return <ImageIcon size={18} className="text-primary" />;
    return <File size={18} className="text-secondary" />;
  };

  const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {grupos.map(grupo => (
        <div key={grupo.tipo_slug}>
          <h4 style={{ 
            fontSize: 'var(--text-sm)', fontWeight: 700, 
            color: 'var(--text-secondary)', marginBottom: '0.75rem',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            {grupo.tipo_nombre}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grupo.documentos.map(doc => (
              <div key={doc.id} className="card p-4 hover:border-primary" style={{ transition: 'all 0.2s' }}>
                <div className="flex items-start gap-3">
                  <div style={{ 
                    padding: '0.75rem', borderRadius: 'var(--radius-md)', 
                    background: 'var(--bg-elevated)' 
                  }}>
                    {getIcon(doc)}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex justify-between items-start">
                      <h5 style={{ fontWeight: 600, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.nombre_display}>
                        {doc.nombre_display}
                      </h5>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {new Date(doc.created_at).toLocaleDateString()} · {(doc.tamano_bytes / 1024 / 1024).toFixed(2)} MB
                    </div>
                    
                    {doc.fecha_vencimiento && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {new Date(doc.fecha_vencimiento) < new Date() ? (
                          <span className="badge badge--danger" style={{ fontSize: '10px' }}>Vencido</span>
                        ) : (
                          <span className="badge badge--warning" style={{ fontSize: '10px' }}>Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div className="flex gap-2">
                    <button className="btn btn--ghost btn--sm p-1" onClick={() => setViewingDoc(doc)} title="Ver / Previsualizar">
                      <Eye size={16} />
                    </button>
                    <button 
                      className="btn btn--ghost btn--sm p-1" 
                      title="Descargar"
                      onClick={async () => {
                        try {
                          toast.loading('Descargando...', { id: 'descarga-list' });
                          const res = await api.get(`/documentos/${doc.id}/descargar`, { responseType: 'blob' });
                          
                          const contentType = res.headers['content-type'] || 'application/octet-stream';
                          const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
                          
                          const link = document.createElement('a');
                          link.href = url;
                          
                          // Asegurar extensión correcta en el nombre de descarga
                          const ext = doc.formato?.toLowerCase() || 'bin';
                          let fileName = doc.nombre_display || 'documento';
                          if (!fileName.toLowerCase().endsWith(`.${ext}`)) {
                            fileName = `${fileName}.${ext}`;
                          }
                          
                          link.setAttribute('download', fileName);
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                          toast.success('Descarga completada', { id: 'descarga-list' });
                        } catch (err) {
                          toast.error('Error al descargar el documento', { id: 'descarga-list' });
                        }
                      }}
                    >
                      <Download size={16} />
                    </button>
                  </div>
                  {!soloLectura && (
                    <button 
                      className="btn btn--ghost btn--sm p-1 text-danger" 
                      onClick={() => {
                        if (window.confirm('¿Eliminar este documento?')) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {viewingDoc && (
        <DocumentoViewer documento={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </div>
  );
}
