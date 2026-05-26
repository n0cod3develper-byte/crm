/**
 * biometrico.service.js
 * Stub preparado para la integración futura con dispositivo biométrico.
 *
 * Cuando se conecte el dispositivo (ZKTeco, Suprema, etc.),
 * solo se implementa este servicio sin cambiar nada más del módulo.
 *
 * El biométrico controlará:
 *   - Evento 1 (salida_cargar): técnico sale de CARGAR
 *   - Evento 4 (ingreso_cargar): técnico regresa a CARGAR
 *
 * Webhook: POST /api/v1/biometrico/evento
 */
import * as repo from '../turnos/turnos.repository.js';
import { logger } from '../../utils/logger.js';

export class BiometricoService {

  /**
   * Procesa un evento crudo del dispositivo biométrico.
   * Se llama desde el webhook POST /api/v1/biometrico/evento.
   *
   * @param {Object} eventoRaw - Payload crudo del dispositivo
   */
  static async procesarEvento(eventoRaw) {
    // TODO: Implementar cuando se conozca el protocolo del dispositivo específico.
    // Formatos comunes: ZKTeco PUSH SDK, OSDP, Wiegand, Suprema BioStar API
    const evento = BiometricoService.mapearEvento(eventoRaw);

    if (!evento) {
      logger.warn('[Biométrico] Evento no reconocido', { raw: eventoRaw });
      return { procesado: false, razon: 'Evento no reconocido' };
    }

    logger.info('[Biométrico] Evento recibido', {
      tipo: evento.tipo,
      empleado_codigo: evento.empleado_codigo,
      timestamp: evento.timestamp,
    });

    if (evento.tipo === 'SALIDA') {
      return BiometricoService.registrarSalidaCargar(evento);
    }

    if (evento.tipo === 'ENTRADA') {
      return BiometricoService.registrarIngresoCargar(evento);
    }

    return { procesado: false, razon: 'Tipo de evento desconocido' };
  }

  /**
   * Mapea el formato crudo del biométrico al formato interno.
   * TODO: Implementar cuando se conozca el protocolo exacto.
   *
   * Campos esperados en el evento interno:
   *   - empleado_codigo: código del empleado (buscar en employees)
   *   - timestamp: Date ISO del evento
   *   - tipo: 'ENTRADA' | 'SALIDA'
   *   - dispositivo_id: número de serie del dispositivo
   */
  static mapearEvento(eventoRaw) {
    // TODO: Ajustar según el protocolo del dispositivo (ZKTeco ejemplo):
    if (!eventoRaw) return null;
    return {
      empleado_codigo: eventoRaw.user_id || eventoRaw.employee_code || eventoRaw.pin,
      timestamp:       eventoRaw.timestamp || eventoRaw.punch_time || new Date().toISOString(),
      tipo:            eventoRaw.punch_type === 1 ? 'ENTRADA' : 'SALIDA',
      dispositivo_id:  eventoRaw.device_sn || eventoRaw.sn,
    };
  }

  /**
   * Evento 1: Técnico sale de CARGAR.
   * TODO: Implementar cuando el biométrico esté configurado.
   */
  static async registrarSalidaCargar(evento) {
    // 1. Buscar empleado por código biométrico
    // 2. Buscar OT activa asignada al técnico
    // 3. Llamar a repo.iniciarServicio con origen_salida_cargar = 'BIOMETRICO'
    logger.info('[Biométrico] STUB: registrarSalidaCargar', evento);
    return { procesado: false, razon: 'Pendiente de implementación' };
  }

  /**
   * Evento 4: Técnico regresa a CARGAR.
   * TODO: Implementar cuando el biométrico esté configurado.
   */
  static async registrarIngresoCargar(evento) {
    // 1. Buscar empleado por código biométrico
    // 2. Buscar servicio en curso del técnico (estado != COMPLETADO)
    // 3. Llamar a repo.registrarIngresoCargar con origen = 'BIOMETRICO'
    logger.info('[Biométrico] STUB: registrarIngresoCargar', evento);
    return { procesado: false, razon: 'Pendiente de implementación' };
  }
}
