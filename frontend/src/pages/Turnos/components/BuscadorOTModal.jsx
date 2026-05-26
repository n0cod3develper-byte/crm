/**
 * BuscadorOTModal.jsx
 * Modal para buscar OTs activas, ver asignación actual y registrar el Evento 1 (salida de CARGAR).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ArrowRight, Loader2, Calendar } from 'lucide-react';
import turnosService from '../../../services/turnosService';

export function BuscadorOTModal({ isOpen, onClose, onConfirm, isSubmitting }) {
  const [queryText, setQueryText] = useState('');
  const [ots, setOts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOt, setSelectedOt] = useState(null);
  
  // Hora de salida manual/retroactiva (por defecto AHORA)
  const [salidaCargar, setSalidaCargar] = useState('');
  const debounceTimer = useRef(null);

  // Inicializar la hora de salida al abrir
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      // Formatear a datetime-local compatible (YYYY-MM-DDTHH:MM)
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
      setSalidaCargar(localISOTime);
      setQueryText('');
      setSelectedOt(null);
      fetchOts('');
    }
  }, [isOpen]);

  const fetchOts = async (searchVal) => {
    setLoading(true);
    try {
      const res = await turnosService.getOTsDisponibles(searchVal);
      setOts(res || []);
    } catch (err) {
      console.error('Error al cargar OTs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQueryText(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchOts(val);
    }, 300);
  };

  const handleConfirm = () => {
    if (!salidaCargar) return;
    onConfirm({
      orden_trabajo_id: selectedOt?.id || null, // Permite iniciar jornada sin OT si es necesario
      salida_cargar: new Date(salidaCargar).toISOString(),
      ubicacion_cliente: null,
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '550px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-app)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              Iniciar Salida a OT
            </h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Selecciona la OT de destino e indica la hora de salida de CARGAR
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{
          padding: '1.25rem 1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* Hora de Salida (Retroactiva) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)'
          }}>
            <label style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}>
              <Calendar size={14} /> HORA DE SALIDA DE CARGAR
            </label>
            <input 
              type="datetime-local" 
              value={salidaCargar}
              onChange={(e) => setSalidaCargar(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)'
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              * Puedes modificar este valor si saliste antes y estás registrando retroactivamente.
            </span>
          </div>

          {/* Buscador de OTs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
              BUSCAR ORDEN DE TRABAJO (OT)
            </label>
            <div style={{ position: 'relative' }}>
              <Search 
                size={16} 
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} 
              />
              <input 
                type="text"
                placeholder="Consecutivo, Cliente, Equipo o Detalle..."
                value={queryText}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.625rem 0.625rem 2.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>
          </div>

          {/* Lista de OTs */}
          <div style={{
            minHeight: '180px',
            maxHeight: '220px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {loading ? (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" size={20} />
                <span>Buscando OTs...</span>
              </div>
            ) : ots.length === 0 ? (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '1rem', textAlign: 'center' }}>
                No se encontraron OTs activas en este momento.
              </div>
            ) : (
              ots.map((ot) => {
                const isSelected = selectedOt?.id === ot.id;
                return (
                  <div 
                    key={ot.id}
                    onClick={() => setSelectedOt(ot)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--clr-primary-50)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--clr-primary-500)', fontSize: 'var(--text-sm)' }}>
                          {ot.consecutivo}
                        </span>
                        <span style={{
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--clr-primary-500)',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {ot.estado}
                        </span>
                      </div>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ot.empresa}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ot.equipo} ({ot.serial})
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ot.detalle_servicio}
                      </span>
                    </div>

                    <div style={{ flexShrink: 0, paddingLeft: '0.75rem' }}>
                      {isSelected ? (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'var(--clr-primary-500)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white'
                        }}>
                          <Check size={12} />
                        </div>
                      ) : (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          border: '2px solid var(--border-color)',
                          background: 'transparent'
                        }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          background: 'var(--bg-app)'
        }}>
          <button 
            type="button"
            onClick={onClose}
            className="btn btn--outline"
            style={{ padding: '0.5rem 1rem', fontSize: 'var(--text-sm)' }}
          >
            Cancelar
          </button>
          
          <button 
            type="button"
            disabled={!selectedOt || !salidaCargar || isSubmitting}
            onClick={handleConfirm}
            className="btn btn--primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Procesando...
              </>
            ) : (
              <>
                Iniciar Viaje <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuscadorOTModal;
