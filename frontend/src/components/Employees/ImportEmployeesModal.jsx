import React, { useState } from 'react';
import Papa from 'papaparse';
import { Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../common/Modal';
import api from '../../lib/api';

export function ImportEmployeesModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);

  const handleDownloadTemplate = () => {
    const csvContent = "full_name,email,identification,phone,company,position,status,hourly_rate\nJuan Perez,juan@example.com,1234567890,3001234567,Mi Empresa S.A.S,Operario,Activo,15000";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_empleados.csv';
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
            const requiredColumns = ['full_name', 'email', 'position'];
            const columns = Object.keys(data[0]);
            const missingColumns = requiredColumns.filter(col => !columns.includes(col));
            
            if (missingColumns.length > 0) {
              validationErrors.push(`Faltan columnas requeridas: ${missingColumns.join(', ')}`);
            }
          }

          if (validationErrors.length > 0) {
            setErrors(validationErrors);
          } else {
            setPreview(data.slice(0, 5)); // Mostrar primeros 5
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
          // Normalize numeric values
          const dataToUpload = results.data.map(row => ({
            ...row,
            hourly_rate: row.hourly_rate ? parseFloat(row.hourly_rate) : 0
          }));

          const res = await api.post('/employees/bulk', dataToUpload);
          toast.success(`Se importaron ${res.data.count} empleados correctamente`);
          onSuccess();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Error al importar empleados');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <Modal title="Importar Empleados" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '400px' }}>
        
        {/* Instructions */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', fontSize: '14px' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> Instrucciones de Formato
          </h4>
          <p style={{ marginBottom: '0.5rem' }}>Sube un archivo <strong>CSV</strong> con las siguientes columnas:</p>
          <ul style={{ listStyle: 'disc', marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
            <li><strong>full_name</strong> (Requerido) — Nombre completo</li>
            <li><strong>email</strong> (Requerido) — Correo electrónico único</li>
            <li><strong>identification</strong> (Opcional) — Cédula o NIT</li>
            <li><strong>phone</strong> (Opcional) — Teléfono</li>
            <li><strong>company</strong> (Opcional) — Empresa a la que pertenece</li>
            <li><strong>position</strong> (Requerido) — Administrativo, Operario o Técnico</li>
            <li><strong>status</strong> (Opcional) — Activo, Inactivo, Vacaciones</li>
            <li><strong>hourly_rate</strong> (Opcional) — Tarifa por hora (número)</li>
          </ul>
          
          <button onClick={handleDownloadTemplate} className="btn btn--outline btn--sm" style={{ marginTop: '1rem' }}>
            <Download size={14} /> Descargar Plantilla
          </button>
        </div>

        {/* Upload Area */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Seleccionar Archivo CSV</label>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '0.5rem', 
              border: '1px dashed var(--border-color)', 
              borderRadius: '8px' 
            }} 
          />
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{ color: 'var(--clr-danger)', fontSize: '14px', background: '#ef444410', padding: '1rem', borderRadius: '8px' }}>
            <strong>Errores encontrados:</strong>
            <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* Preview */}
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
                    <th style={{ padding: '0.5rem' }}>Email</th>
                    <th style={{ padding: '0.5rem' }}>Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem' }}>{row.full_name}</td>
                      <td style={{ padding: '0.5rem' }}>{row.email}</td>
                      <td style={{ padding: '0.5rem' }}>{row.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn--outline" onClick={onClose} disabled={loading}>Cancelar</button>
          <button 
            className="btn btn--primary" 
            onClick={handleImport} 
            disabled={!file || errors.length > 0 || loading}
          >
            {loading ? 'Importando...' : (
              <>
                <Upload size={16} /> Importar Datos
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
