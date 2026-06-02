import { useRef, useState } from 'react';
import { Upload, File, X, Image as ImageIcon, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export function EvidenciasUploader({ ordenId, onUpload, evidencias = [], onDelete }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('descripcion', file.name);
      await onUpload(ordenId, fd);
      toast.success('Archivo subido');
    } catch (err) {
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const getIcon = (mime) => {
    if (mime?.startsWith('image/')) return <ImageIcon size={16} />;
    if (mime?.includes('pdf')) return <FileText size={16} />;
    return <File size={16} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn btn--primary btn--sm"
        >
          <Upload size={16} />
          {uploading ? 'Subiendo...' : 'Subir archivo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleUpload}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
        />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Máx. 10MB</span>
      </div>

      {evidencias.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
          {evidencias.map((ev) => (
            <li key={ev.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                {getIcon(ev.tipo_mime)}
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.nombre_archivo}
                </span>
                {ev.tamano_bytes && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    ({(ev.tamano_bytes / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDelete?.(ev.id)}
                className="btn btn--ghost btn--sm"
                style={{ color: 'var(--text-muted)' }}
                title="Eliminar"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
