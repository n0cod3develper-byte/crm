import { query, withTransaction } from '../../config/database.js';
import { LocativoRepository } from './locativo.repository.js';

const repo = new LocativoRepository();

/**
 * Valida las reglas contables según NIIF para PYMES (Sección 17)
 * y el Estatuto Tributario colombiano.
 *
 * Referencias legales:
 * - NIIF para PYMES Sección 17: Propiedades, Planta y Equipo
 * - NIC 16: Propiedades, Planta y Equipo (para activos capitalizables)
 * - Estatuto Tributario colombiano Art. 70: Deducción de mejoras en propiedades ajenas
 * - Estatuto Tributario colombiano Art. 137: Depreciación de activos fijos
 */
export function validarReglasContables(datos) {
  const errores = [];

  // ── Regla 1: Si clasificacion_contable = 'ACTIVO' ──────────
  // NIIF PYMES 17.9: Una partida de PPE debe medirse por su costo.
  // NIIF PYMES 17.16: El costo incluye el precio de compra y costos directamente atribuibles.
  if (datos.clasificacion_contable === 'ACTIVO') {
    if (!datos.costo_historico || parseFloat(datos.costo_historico) <= 0) {
      errores.push({
        campo: 'costo_historico',
        mensaje: 'El costo histórico es obligatorio para activos capitalizables. (NIIF PYMES 17.9)',
      });
    }
    if (!datos.vida_util_anios || parseFloat(datos.vida_util_anios) <= 0) {
      errores.push({
        campo: 'vida_util_anios',
        mensaje: 'La vida útil es obligatoria para activos capitalizables. (NIIF PYMES 17.17)',
      });
    }
  }

  // ── Regla 2: Si tipo_propiedad = 'ARRENDADA' ───────────────
  // Estatuto Tributario Art. 70: Las mejoras en propiedades ajenas
  // se deprecian en el menor plazo entre la vida útil del activo
  // y la duración del contrato de arrendamiento.
  // NIIF PYMES 20.4: Arrendamientos - la vida útil del activo
  // se limita al plazo del arrendamiento si este es menor.
  if (datos.tipo_propiedad === 'ARRENDADA') {
    if (!datos.fecha_fin_contrato) {
      errores.push({
        campo: 'fecha_fin_contrato',
        mensaje: 'La fecha fin del contrato de arrendamiento es obligatoria para mejoras en propiedades ajenas. (ET Art. 70)',
      });
    }

    if (datos.fecha_fin_contrato && datos.vida_util_anios) {
      const hoy = new Date();
      const finContrato = new Date(datos.fecha_fin_contrato);
      const diffMs = finContrato - hoy;
      const aniosContrato = diffMs / (1000 * 60 * 60 * 24 * 365.25);

      // Si incluye prórrogas pactadas, la duración se extiende
      const aniosEfectivos = datos.incluye_prorrogas
        ? Math.max(aniosContrato, aniosContrato + 1) // Aproximación de prórroga por 1 año
        : aniosContrato;

      if (aniosEfectivos < 0) {
        errores.push({
          campo: 'fecha_fin_contrato',
          mensaje: 'La fecha fin del contrato ya ha vencido. No es posible capitalizar mejoras en un contrato vencido.',
        });
      } else if (parseFloat(datos.vida_util_anios) > aniosEfectivos) {
        errores.push({
          campo: 'vida_util_anios',
          mensaje: `Para mejoras en propiedades arrendadas, la vida útil (${datos.vida_util_anios} años) no puede superar la duración del contrato (${aniosEfectivos.toFixed(1)} años). La depreciación se calcula en el menor plazo entre la vida útil del activo y la duración del contrato de arrendamiento. (ET Art. 70, NIIF PYMES 20.4)`,
        });
      }
    }
  }

  // ── Regla 3: Si clasificacion_contable = 'GASTO' ───────────
  // Los gastos de mantenimiento no se capitalizan, van directo a resultados.
  // NIIF PYMES 17.6: Los costos de mantenimiento diario no se reconocen como PPE.
  if (datos.clasificacion_contable === 'GASTO') {
    // método_depreciacion debe ser NO_APLICA automáticamente (se maneja en controller)
  }

  return errores;
}

/**
 * Genera el código interno LOC-YYYY-XXXXX usando la secuencia
 * con SELECT FOR UPDATE para evitar duplicados concurrentes.
 */
export async function generarCodigoLocativo() {
  return withTransaction(async (conn) => {
    const anio = new Date().getFullYear();
    const result = await conn.query(
      `SELECT nextval('seq_inventario_locativo') AS nro`
    );
    const nro = result.rows[0].nro;
    return `LOC-${anio}-${String(nro).padStart(5, '0')}`;
  });
}

/**
 * Prepara los datos antes de guardar, aplicando reglas de negocio.
 */
export function prepararDatosLocativo(datos, usuario) {
  const preparados = { ...datos };

  // Si es GASTO, forzar método de depreciación a NO_APLICA
  if (preparados.clasificacion_contable === 'GASTO') {
    preparados.metodo_depreciacion = 'NO_APLICA';
    // Limpiar campos de activo que no aplican
    if (!('costo_historico' in datos)) preparados.costo_historico = null;
    if (!('vida_util_anios' in datos)) preparados.vida_util_anios = null;
    if (!('valor_residual' in datos)) preparados.valor_residual = 0;
  }

  // Fecha inicio depreciación = fecha adquisición si no se especifica
  if (preparados.clasificacion_contable === 'ACTIVO') {
    if (preparados.fecha_adquisicion && !preparados.fecha_inicio_depreciacion) {
      preparados.fecha_inicio_depreciacion = preparados.fecha_adquisicion;
    }
  }

  // Tomar snapshot del nombre del responsable
  if (preparados.responsable_id && !preparados.responsable_nombre) {
    // Se resolverá en el controller
  }

  // Registrar quién registra
  if (usuario) {
    const nombre = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.email || 'Sistema';
    preparados.registrado_por = nombre;
  }

  // Parsear especificaciones JSONB si viene como string (desde req.body)
  // NOTA: pg serializa objetos JS a JSONB automáticamente. 
  // Si viene como string, se parsea a objeto para que pg lo maneje correctamente.
  if (preparados.especificaciones && typeof preparados.especificaciones === 'string') {
    try {
      preparados.especificaciones = JSON.parse(preparados.especificaciones);
    } catch {
      // Si falla el parse, se deja como está (pg lo manejará como string)
    }
  }

  return preparados;
}
