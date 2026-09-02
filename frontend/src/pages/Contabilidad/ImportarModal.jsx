import React, { useState } from 'react';
import { Upload, X, AlertCircle, Download, FileSpreadsheet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function ImportarModal({ isOpen, onClose, onSuccess }) {
  const currentYear = new Date().getFullYear();
  const [anio, setAnio] = useState(currentYear);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleDownloadTemplate = async (formato = 'excel') => {
    setIsDownloading(true);
    try {
      const response = await api.get(`/contabilidad/plantilla?formato=${formato}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: formato === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'text/csv;charset=utf-8;'
      });

      const filename = formato === 'excel' 
        ? 'plantilla_libro_mayor.xlsx' 
        : 'plantilla_libro_mayor.csv';

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Plantilla ${formato.toUpperCase()} descargada`);
    } catch (err) {
      toast.error('Error al descargar la plantilla de ejemplo');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Por favor seleccione un archivo (.xlsx, .xls, .csv, .tsv, .txt)');
      return;
    }

    const formData = new FormData();
    formData.append('documento', file);
    formData.append('anio', anio);
    formData.append('mes', mes);

    setIsUploading(true);
    try {
      const res = await api.post('/contabilidad/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data?.message || 'Archivo importado exitosamente');
      onSuccess(res.data?.periodoId);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al importar el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--bg-elevated, #1e293b)',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--border-color, #334155)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={20} className="text-primary" /> Importar Libro Mayor
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
              Carga saldos contables en Excel (.xlsx), CSV o archivo plano (.txt, .tsv)
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isUploading}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Download Template Section */}
        <div style={{
          background: 'rgba(30, 58, 138, 0.25)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Download size={18} style={{ color: '#60a5fa' }} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              ¿No tienes el archivo con el formato correcto?
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
            Descarga la plantilla con las columnas estructuradas, llena la información de tu software contable y súbela aquí.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => handleDownloadTemplate('excel')}
              disabled={isDownloading}
            >
              <FileSpreadsheet size={15} style={{ color: '#22c55e' }} />
              Descargar Plantilla Excel (.xlsx)
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => handleDownloadTemplate('csv')}
              disabled={isDownloading}
            >
              <FileText size={15} style={{ color: '#60a5fa' }} />
              Descargar Plantilla CSV (.csv)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Period Selector (Year and Month) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                Año del Período
              </label>
              <input
                type="number"
                className="input"
                style={{ width: '100%' }}
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                min="2000"
                max="2100"
                required
                disabled={isUploading}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                Mes del Período
              </label>
              <select
                className="input"
                style={{ width: '100%' }}
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                disabled={isUploading}
              >
                {meses.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* File Upload Box */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              Seleccionar Archivo a Importar
            </label>
            <div style={{
              border: file ? '2px solid #3b82f6' : '2px dashed var(--border-color, #475569)',
              borderRadius: '8px',
              padding: '1.5rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface, #0f172a)',
              transition: 'all 0.2s'
            }}>
              <input
                type="file"
                id="file-input"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
              <label htmlFor="file-input" style={{ cursor: 'pointer', display: 'block' }}>
                <Upload size={30} style={{ margin: '0 auto 0.5rem', color: file ? '#3b82f6' : 'var(--text-muted, #94a3b8)' }} />
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 600 }}>
                  {file ? file.name : 'Haz clic o arrastra el archivo aquí'}
                </p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Formatos soportados: <strong>Excel (.xlsx, .xls)</strong>, <strong>CSV (.csv)</strong>, <strong>Texto (.txt, .tsv)</strong>
                </p>
              </label>
            </div>
          </div>

          {/* Info Notice */}
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.1)', 
            border: '1px solid rgba(59, 130, 246, 0.2)', 
            borderRadius: '6px', 
            padding: '0.75rem', 
            marginBottom: '1.25rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start'
          }}>
            <AlertCircle size={18} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#93c5fd', lineHeight: 1.4 }}>
              Si el período ya fue cargado previamente, la nueva importación <strong>sobrescribirá</strong> los saldos anteriores de forma limpia y actualizará el catálogo de cuentas.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isUploading || !file}
            >
              {isUploading ? 'Procesando e Importando...' : 'Importar Archivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
