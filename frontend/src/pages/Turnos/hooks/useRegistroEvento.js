/**
 * useRegistroEvento.js
 * Custom hook con mutaciones para los 5 eventos de Control de Turnos.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import turnosService from '../../../services/turnosService';

/**
 * Extrae el mensaje de error de la respuesta, manejando tanto
 * formato string (error: 'mensaje') como objeto (error: { message: 'mensaje' }).
 */
function extraerError(err) {
  if (!err) return null;
  if (typeof err?.error === 'string') return err.error;
  if (err?.error?.message) return err.error.message;
  if (err?.message) return err.message;
  return null;
}

export function useRegistroEvento() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['turnoActivo'] });
    queryClient.invalidateQueries({ queryKey: ['turnosList'] });
  };

  // Evento 1: Iniciar servicio (Salida de CARGAR)
  const iniciarServicioMutation = useMutation({
    mutationFn: async (payload) => {
      try {
        return await turnosService.iniciarServicio(payload);
      } catch (err) {
        // Transformar el error para que mutateAsync rechace con datos estructurados
        const errorData = err.response?.data || err;
        throw errorData;
      }
    },
    onSuccess: () => {
      toast.success('Servicio iniciado. ¡Buen viaje!');
      invalidate();
    },
    onError: (err) => {
      // Si es TURNO_CERRADO el componente maneja el toast personalizado
      if (err?.codigo === 'TURNO_CERRADO') return;
      toast.error(extraerError(err) || 'Error al iniciar servicio');
    }
  });

  // Evento 2: Inicio servicio (Llegada al cliente)
  const inicioServicioMutation = useMutation({
    mutationFn: ({ servicioId, data }) => turnosService.registrarInicioServicio(servicioId, data),
    onSuccess: () => {
      toast.success('Llegada registrada. Servicio en proceso.');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al registrar llegada');
    }
  });

  // Evento 3: Fin servicio (Termina el trabajo)
  const finServicioMutation = useMutation({
    mutationFn: ({ servicioId, data }) => turnosService.registrarFinServicio(servicioId, data),
    onSuccess: () => {
      toast.success('Fin de servicio registrado. De regreso a CARGAR.');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al registrar fin de servicio');
    }
  });

  // Evento 4: Ingreso a CARGAR (Fin de viaje de regreso)
  const ingresoCargarMutation = useMutation({
    mutationFn: ({ servicioId, data }) => turnosService.registrarIngresoCargar(servicioId, data),
    onSuccess: () => {
      toast.success('Regreso registrado exitosamente.');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al registrar llegada a CARGAR');
    }
  });

  // Evento 5: Cerrar turno
  const cerrarTurnoMutation = useMutation({
    mutationFn: async ({ turnoId, data }) => {
      try {
        return await turnosService.cerrarTurno(turnoId, data);
      } catch (err) {
        const errorData = err.response?.data || err;
        throw errorData;
      }
    },
    onSuccess: () => {
      toast.success('Jornada laboral cerrada con éxito.');
      invalidate();
    },
    onError: (err) => {
      // SERVICIOS_INCOMPLETOS lo maneja el componente (muestra confirmación)
      if (err?.codigo === 'SERVICIOS_INCOMPLETOS') return;
      toast.error(extraerError(err) || 'Error al cerrar jornada');
    }
  });

  // Reabrir turno cerrado
  const reabrirTurnoMutation = useMutation({
    mutationFn: turnosService.reabrirTurno,
    onSuccess: () => {
      toast.success('Turno reabierto. ¡Puedes continuar tu jornada!');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al reabrir el turno');
    },
  });

  return {
    iniciarServicio: iniciarServicioMutation.mutateAsync,
    isStarting: iniciarServicioMutation.isPending,

    registrarInicioServicio: inicioServicioMutation.mutateAsync,
    isArriving: inicioServicioMutation.isPending,

    registrarFinServicio: finServicioMutation.mutateAsync,
    isFinishing: finServicioMutation.isPending,

    registrarIngresoCargar: ingresoCargarMutation.mutateAsync,
    isReturning: ingresoCargarMutation.isPending,

    cerrarTurno: cerrarTurnoMutation.mutateAsync,
    isClosing: cerrarTurnoMutation.isPending,

    reabrirTurno: reabrirTurnoMutation.mutateAsync,
    isReopening: reabrirTurnoMutation.isPending,
  };
}

export default useRegistroEvento;
