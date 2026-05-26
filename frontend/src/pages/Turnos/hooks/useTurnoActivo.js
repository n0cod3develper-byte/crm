/**
 * useTurnoActivo.js
 * Custom hook para obtener y mantener actualizado el turno activo del técnico.
 */
import { useQuery } from '@tanstack/react-query';
import turnosService from '../../../services/turnosService';

export function useTurnoActivo() {
  return useQuery({
    queryKey: ['turnoActivo'],
    queryFn: async () => {
      try {
        const res = await turnosService.getTurnoActivo();
        return res || null;
      } catch (err) {
        // Si es 404 o similar porque no tiene empleado asignado, devolvemos null o propagamos
        if (err.response?.status === 400 || err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    refetchInterval: 30000, // Polling cada 30 segundos
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export default useTurnoActivo;
