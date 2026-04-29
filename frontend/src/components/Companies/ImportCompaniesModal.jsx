import React, { useState } from 'react';
import Papa from 'papaparse';
import { Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../common/Modal';
import api from '../../lib/api';

export function ImportCompaniesModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);

  const handleDownloadTemplate = () => {
    const csvContent = "name,nit,industry,department,website,phone,phone_2,city,address\nMi Empresa SAS,900123456-1,logistics,Cundinamarca,https://miempresa.com,3001234567,3112345678,Bogota,Calle 123";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_empresas.csv';
    link.click();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setErrors([]);
    setPreview([]);

    if (selectedFile) {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data;
          const validationErrors = [];
          
          if (data.length === 0) {
            validationErrors.push('El archivo está vacío');
          } else {
            const requiredColumns = ['name'];
            const columns = Object.keys(data[0]);
            const missingColumns = requiredColumns.filter(col => !columns.includes(col));
            
            if (missingColumns.length > 0) {
              validationErrors.push(`Faltan columnas requeridas: ${missingColumns.join(', ')}`);
            }
          }

          if (validationErrors.length > 0) {
            setErrors(validationErrors);
          } else {
            setPreview(data.slice(0, 5));
          }
        },
        error: (error) => {
          setErrors([`Error leyendo archivo: ${error.message}`]);
        }
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await api.post('/companies/bulk', results.data);
          toast.success(`Se importaron ${res.data.count} empresas correctamente`);
          onSuccess();
        } catch (error) {
          const errMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Error al importar empresas';
          toast.error(errMsg);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <Modal title="Importar Empresas" onClose={onClose} maxWidth="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', fontSize: '14px' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> Instrucciones de Formato
          </h4>
          <p style={{ marginBottom: '0.5rem' }}>Sube un archivo <strong>CSV</strong> con las siguientes columnas:</p>
          <ul style={{ listStyle: 'disc', marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
            <li><strong>name</strong> (Requerido) — Nombre de la empresa</li>
            <li><strong>nit</strong> (Opcional) — NIT de la empresa</li>
            <li><strong>industry</strong> (Opcional) — Sector (ej: logistics)</li>
            <li><strong>department</strong> (Opcional) — Departamento (ej: Antioquia)</li>
            <li><strong>website</strong> (Opcional) — Sitio Web</li>
            <li><strong>phone</strong> (Opcional) — Teléfono principal</li>
            <li><strong>phone_2</strong> (Opcional) — Teléfono secundario</li>
            <li><strong>city</strong> (Opcional) — Ciudad</li>
            <li><strong>address</strong> (Opcional) — Dirección</li>
          </ul>
          
          <button onClick={handleDownloadTemplate} className="btn btn--outline btn--sm" style={{ marginTop: '1rem' }}>
            <Download size={14} /> Descargar Plantilla
          </button>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Seleccionar Archivo CSV</label>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }} 
          />
        </div>

        {errors.length > 0 && (
          <div style={{ color: 'var(--clr-danger)', fontSize: '14px', background: '#ef444410', padding: '1rem', borderRadius: '8px' }}>
            <strong>Errores encontrados:</strong>
            <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {preview.length > 0 && errors.length === 0 && (
          <div style={{ fontSize: '14px' }}>
            <strong style={{ color: 'var(--clr-success)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={16} /> Archivo válido. Vista previa ({preview.length} filas):
            </strong>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem' }}>Nombre</th>
                    <th style={{ padding: '0.5rem' }}>NIT</th>
                    <th style={{ padding: '0.5rem' }}>Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem' }}>{row.name}</td>
                      <td style={{ padding: '0.5rem' }}>{row.nit}</td>
                      <td style={{ padding: '0.5rem' }}>{row.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn--outline" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn--primary" onClick={handleImport} disabled={!file || errors.length > 0 || loading}>
            {loading ? 'Importando...' : <><Upload size={16} /> Importar Datos</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
