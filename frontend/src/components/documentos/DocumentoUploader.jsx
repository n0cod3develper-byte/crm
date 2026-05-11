import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UploadCloud, X, File, Image as ImageIcon, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

const MAX_SIZE_MB = 10;

export function DocumentoUploader({ entidadTipo, entidadId, tiposPermitidos = [], onUploadSuccess, multiple = false, onClose }) {
  const [tipos, setTipos] = useState([]);
  const [selectedTipo, setSelectedTipo] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Metadatos
  const [nombreDisplay, setNombreDisplay] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaDocumento, setFechaDocumento] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [esConfidencial, setEsConfidencial] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    // Cargar tipos de documento para esta entidad
    const fetchTipos = async () => {
      try {
        const { data } = await api.get(`/documentos/tipos?aplica_a=${entidadTipo}`);
        let tiposData = data.data || data;
        if (tiposPermitidos.length > 0) {
          tiposData = tiposData.filter(t => tiposPermitidos.includes(t.slug));
        }
        setTipos(tiposData);
        if (tiposData.length === 1) {
          setSelectedTipo(tiposData[0].id);
        }
      } catch (err) {
        toast.error('Error al cargar tipos de documento');
      }
    };
    fetchTipos();
  }, [entidadTipo, tiposPermitidos?.join(',')]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validar tamaño y cantidad
    if (!multiple && selectedFiles.length > 1) {
      toast.error('Solo puedes subir un archivo a la vez');
      return;
    }
    
    if (selectedFiles.some(f => f.size > MAX_SIZE_MB * 1024 * 1024)) {
      toast.error(`El archivo no puede pesar más de ${MAX_SIZE_MB}MB`);
      return;
    }

    setFiles(selectedFiles);
    if (selectedFiles.length === 1 && !nombreDisplay) {
      setNombreDisplay(selectedFiles[0].name.split('.')[0]); // Nombre sin extensión
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length === 1) setNombreDisplay('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return toast.error('Debes seleccionar un archivo');
    if (!selectedTipo) return toast.error('Debes seleccionar el tipo de documento');

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    files.forEach(f => formData.append(multiple ? 'documentos' : 'documento', f));
    
    formData.append('tipo_documento_id', selectedTipo);
    if (nombreDisplay) formData.append('nombre_display', nombreDisplay);
    if (descripcion) formData.append('descripcion', descripcion);
    if (fechaDocumento) formData.append('fecha_documento', fechaDocumento);
    if (fechaVencimiento) formData.append('fecha_vencimiento', fechaVencimiento);
    formData.append('es_confidencial', esConfidencial);

    try {
      const endpoint = multiple 
        ? `/documentos/entidad/${entidadTipo}/${entidadId}`
        : `/documentos/entidad/${entidadTipo}/${entidadId}/single`;
      
      const tipoSlug = tipos.find(t => t.id === selectedTipo)?.slug || 'general';

      const res = await api.post(`${endpoint}?tipo_slug=${tipoSlug}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) {
            setProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        }
      });

      toast.success('Documento subido correctamente');
      onUploadSuccess?.(res.data.data);
      if (onClose) onClose();
      
      // Reset
      setFiles([]);
      setNombreDisplay('');
      setDescripcion('');
      setFechaDocumento('');
      setFechaVencimiento('');
      setEsConfidencial(false);
      if (tipos.length > 1) setSelectedTipo('');
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir el documento');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="card p-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* Zona Drag & Drop */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: files.length > 0 ? 'var(--bg-elevated)' : 'transparent',
            transition: 'all 0.2s',
          }}
          className="hover:border-primary hover:bg-elevated"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            multiple={multiple}
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
          />
          <UploadCloud size={32} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
          {files.length === 0 ? (
            <>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Haz clic o arrastra un archivo aquí</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                PDF, JPG, PNG, DOCX, XLSX hasta 10MB
              </p>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2" style={{ background: 'var(--bg-body)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)' }}>
                  {f.type.includes('pdf') ? <FileText size={16} className="text-danger" /> : 
                   f.type.includes('image') ? <ImageIcon size={16} className="text-primary" /> : 
                   <File size={16} className="text-secondary" />}
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{f.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="btn btn--ghost p-1 ml-2" style={{ height: 'auto' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <label className="input-label">Tipo de Documento <span className="text-danger">*</span></label>
            <select 
              className="input" 
              required 
              value={selectedTipo} 
              onChange={e => setSelectedTipo(e.target.value)}
              disabled={tipos.length === 1}
            >
              <option value="">Seleccione...</option>
              {tipos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          
          <div className="input-group">
            <label className="input-label">Nombre a mostrar</label>
            <input 
              className="input" 
              value={nombreDisplay} 
              onChange={e => setNombreDisplay(e.target.value)}
              placeholder="Ej: RUT 2024"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <label className="input-label">Fecha del documento</label>
            <input 
              type="date" 
              className="input" 
              value={fechaDocumento} 
              onChange={e => setFechaDocumento(e.target.value)}
            />
          </div>
          
          <div className="input-group">
            <label className="input-label">Fecha de vencimiento</label>
            <input 
              type="date" 
              className="input" 
              value={fechaVencimiento} 
              onChange={e => setFechaVencimiento(e.target.value)}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Descripción o notas (opcional)</label>
          <textarea 
            className="input" 
            rows="2"
            value={descripcion} 
            onChange={e => setDescripcion(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input 
            type="checkbox" 
            id="confidencial" 
            className="custom-checkbox"
            checked={esConfidencial}
            onChange={e => setEsConfidencial(e.target.checked)}
          />
          <label htmlFor="confidencial" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            Marcar como documento confidencial
          </label>
        </div>

        {uploading && (
          <div className="mt-4">
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--clr-primary-500)', transition: 'width 0.2s' }} />
            </div>
            <div className="text-right text-xs mt-1 text-muted">{progress}% subido</div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
          {onClose && (
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={uploading}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={uploading || files.length === 0 || !selectedTipo}>
            {uploading ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> Subiendo...</>
            ) : (
              <>Subir documento</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
