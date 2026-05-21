/**
 * TurnoPage.jsx
 * Cockpit principal del técnico (Mobile-First / Responsive).
 * Permite iniciar jornada, registrar servicios lineales en 5 eventos y ver historial.
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Topbar } from '../../components/layout/Topbar';
import { useTurnoActivo } from './hooks/useTurnoActivo';
import { useRegistroEvento } from './hooks/useRegistroEvento';
import { CronometroTurno } from './components/CronometroTurno';
import { RegistroEventos } from './components/RegistroEventos';
import { BuscadorOTModal } from './components/BuscadorOTModal';
import { ServicioCard } from './components/ServicioCard';
import { ResumenTurnoModal } from './components/ResumenTurnoModal';
import { Clock, Plus, AlertCircle, Calendar, LogOut, CheckCircle2, RotateCcw } from 'lucide-react';

export function TurnoPage() {
  const queryClient = useQueryClient();
  const { data: turnoActivo, isLoading: loadingTurno, error } = useTurnoActivo();
  const mutations = useRegistroEvento();

  // Modales
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  
  // Manejo de errores de cierre
  const [errorIncompletos, setErrorIncompletos] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Iniciar primer servicio / salida a OT (Evento 1)
  const handleStartService = async (payload) => {
    setSubmitting(true);
    try {
      await mutations.iniciarServicio(payload);
      setIsSearchOpen(false);
      // Forzar refetch inmediato para que la UI muestre el servicio recién creado
      await queryClient.invalidateQueries({ queryKey: ['turnoActivo'] });
    } catch (err) {
      // Siempre refrescar el turno al fallar: si ya existe un servicio en curso,
      // la UI se actualizará para mostrarlo con sus botones de transición.
      await queryClient.invalidateQueries({ queryKey: ['turnoActivo'] });
      setIsSearchOpen(false);

      // err ya viene transformado por mutationFn: { codigo, turnoId, error }
      if (err?.codigo === 'TURNO_CERRADO') {
        toast.custom(
          (t) => (
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem 1.5rem',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'all 0.2s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🛑</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                    Turno cerrado
                  </strong>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    El turno del día ya está cerrado. Puedes reabrirlo para continuar registrando servicios.
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="btn btn--outline"
                  style={{ padding: '0.375rem 0.75rem', fontSize: 'var(--text-xs)' }}
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    mutations.reabrirTurno(err.turnoId);
                  }}
                  disabled={mutations.isReopening}
                  className="btn btn--primary"
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: 'var(--clr-warning)',
                    borderColor: 'var(--clr-warning)',
                    color: '#000',
                  }}
                >
                  {mutations.isReopening ? (
                    <span className="spinner" style={{ width: '14px', height: '14px' }} />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Reabrir Turno
                </button>
              </div>
            </div>
          ),
          { duration: 15000, position: 'top-center' }
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cerrar jornada laboral (Evento 5)
  const handleCloseShift = async (payload) => {
    if (!turnoActivo) return;
    setSubmitting(true);
    try {
      await mutations.cerrarTurno({
        turnoId: turnoActivo.id,
        data: {
          fin_turno: payload.fin_turno,
          forzar: payload.forzar,
        }
      });
      setIsCloseOpen(false);
      setErrorIncompletos(null);
    } catch (err) {
      if (err?.codigo === 'SERVICIOS_INCOMPLETOS') {
        setErrorIncompletos(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTurno) {
    return (
      <div className="app-layout">
        <main className="main-content" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
          <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }} />
        </main>
      </div>
    );
  }

  // Si hay error porque el técnico no está configurado (por ejemplo, no tiene empleado activo en crm)
  if (error) {
    return (
      <div className="app-layout">
        <Topbar title="Control de Turnos" subtitle="Error de configuración" />
        <main className="main-content">
          <div className="empty-state" style={{ background: 'var(--bg-surface)', padding: '3rem', borderRadius: 'var(--radius-lg)' }}>
            <AlertCircle size={48} className="text-danger" style={{ color: 'var(--clr-danger)' }} />
            <h2 className="empty-state__title" style={{ marginTop: '1rem' }}>No Vinculado</h2>
            <p className="empty-state__desc" style={{ maxWidth: '400px', margin: '0.5rem auto' }}>
              Tu usuario no está asociado a ningún empleado activo en el CRM.
              Por favor contacta al administrador para vincular tu ficha de empleado.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Buscar servicio en curso
  const servicioActivo = turnoActivo?.servicios?.find(s => s.estado_servicio !== 'COMPLETADO');
  const serviciosCompletados = turnoActivo?.servicios?.filter(s => s.estado_servicio === 'COMPLETADO') || [];

  return (
    <div className="app-layout">
      <Topbar 
        title="Mi Turno de Trabajo" 
        subtitle={turnoActivo ? `Turno activo de hoy: ${turnoActivo.fecha_turno}` : 'Sin turno activo'} 
      />

      <main className="main-content" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* ESTADO 1: Sin turno activo */}
        {!turnoActivo ? (
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '3rem 2rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(37, 99, 235, 0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--clr-primary-500)'
            }}>
              <Clock size={32} />
            </div>

            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0 }}>
                ¡Hola! ¿Listo para iniciar tu jornada?
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: '420px', margin: '0.5rem auto 0 auto', lineHeight: 1.4 }}>
                Inicia tu jornada registrando la salida de CARGAR hacia tu primera orden de trabajo (OT) asignada.
              </p>
            </div>

            <button 
              onClick={() => setIsSearchOpen(true)}
              className="btn btn--primary"
              style={{
                padding: '0.75rem 2rem',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--clr-primary-500)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-glow)'
              }}
            >
              <Plus size={18} /> Iniciar Jornada / Salir a OT
            </button>
          </div>
        ) : (
          /* ESTADO 2: Con turno activo */
          <>
            {/* Visualizador de tiempo en real-time */}
            <CronometroTurno inicioTurno={turnoActivo.inicio_turno} />

            {/* Servicio en curso (si lo hay) */}
            {servicioActivo ? (
              <RegistroEventos 
                servicio={servicioActivo}
                onArrive={mutations.registrarInicioServicio}
                onFinish={mutations.registrarFinServicio}
                onReturn={mutations.registrarIngresoCargar}
                isSubmitting={mutations.isArriving || mutations.isFinishing || mutations.isReturning}
              />
            ) : (
              /* Entre servicios (en base o listo para salir) */
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem 1.5rem',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                textAlign: 'center',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--clr-success)'
                }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800 }}>
                    Estás disponible en CARGAR
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Puedes reportar una nueva salida a otra OT o dar por terminada tu jornada del día.
                  </p>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  width: '100%',
                  maxWidth: '420px',
                  marginTop: '0.5rem'
                }}>
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="btn btn--primary"
                    style={{
                      padding: '0.625rem',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Plus size={14} /> Nueva OT / Salida
                  </button>
                  
                  <button 
                    onClick={() => {
                      setErrorIncompletos(null);
                      setIsCloseOpen(true);
                    }}
                    className="btn btn--outline"
                    style={{
                      padding: '0.625rem',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      color: 'var(--clr-danger)',
                      borderColor: 'var(--clr-danger)'
                    }}
                  >
                    <LogOut size={14} /> Cerrar Jornada
                  </button>
                </div>
              </div>
            )}

            {/* Listado de Servicios Completados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 800, margin: 0, color: 'var(--text-secondary)' }}>
                SERVICIOS DE HOY ({serviciosCompletados.length})
              </h3>
              {serviciosCompletados.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--bg-surface)'
                }}>
                  No has completado servicios todavía.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {serviciosCompletados.map((s) => (
                    <ServicioCard key={s.id} servicio={s} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Modal buscador de OT */}
      <BuscadorOTModal 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onConfirm={handleStartService}
        isSubmitting={submitting}
      />

      {/* Modal de cierre de jornada */}
      <ResumenTurnoModal 
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        onConfirm={handleCloseShift}
        isSubmitting={submitting}
        errorIncompletos={errorIncompletos}
      />
    </div>
  );
}

export default TurnoPage;
