import React from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, footer, onClose, maxWidth = '560px' }) {
  // El modal NO se cierra con Escape ni con clic en el backdrop.
  // Solo se cierra con los botones explícitos de la UI (X, Cancelar, Guardar).
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="modal-overlay">
      <div 
        className="modal" 
        style={{ maxWidth }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal__body">
          {children}
        </div>

        {footer && (
          <div className="modal__footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
