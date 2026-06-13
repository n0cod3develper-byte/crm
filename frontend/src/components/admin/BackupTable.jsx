import React, { useState } from 'react';
import { Download, Trash2, Database, Clock, HardDrive } from 'lucide-react';

export const BackupTable = ({ backups, onDelete, isDeleting }) => {
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  if (!backups || !Array.isArray(backups) || backups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Database size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
        <p>No hay respaldos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nombre de Archivo</th>
            <th>Base de Datos</th>
            <th>Tamaño</th>
            <th>Fecha de Creación</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((bkp) => (
            <tr key={bkp.filename}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={16} className="text-muted" />
                  <span className="font-semibold">{bkp.filename}</span>
                </div>
              </td>
              <td>{bkp.dbName}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HardDrive size={16} className="text-muted" />
                  {bkp.sizeFormatted}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} className="text-muted" />
                  {new Date(bkp.createdAt).toLocaleString()}
                </div>
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                  <a
                    href={`/api/backups/download/${bkp.filename}`}
                    className="btn btn--ghost btn--sm"
                    title="Descargar"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download size={14} /> Descargar
                  </a>
                  <button
                    className="btn btn--danger btn--sm"
                    title="Eliminar"
                    onClick={() => setDeleteCandidate(bkp)}
                    disabled={isDeleting}
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleteCandidate && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h3 className="font-bold">Eliminar Respaldo</h3>
              <p className="text-xs text-muted">Esta acción es irreversible</p>
            </div>
            <div className="modal__body">
              <p>¿Estás seguro de que deseas eliminar permanentemente el respaldo <strong>{deleteCandidate.filename}</strong>?</p>
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary" onClick={() => setDeleteCandidate(null)}>Cancelar</button>
              <button 
                className="btn btn--danger" 
                onClick={() => {
                  onDelete(deleteCandidate.filename);
                  setDeleteCandidate(null);
                }}
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
