/**
 * horasExtras.motor.test.js
 * Pruebas unitarias del motor PURO de horas extras.
 * Sin dependencias de BD — importa directamente horasExtras.motor.js.
 */

import { calcularHorasExtrasMotor, getTipoDia } from '../horasExtras.motor.js';

// ─── Datos de prueba ──────────────────────────────────────────

const FESTIVOS_2026 = new Set([
  '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
  '2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-07-06',
  '2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02',
  '2026-11-16','2026-12-08','2026-12-25',
]);

const CFG = [
  // LUN_JUE
  { dia_aplicacion:'LUN_JUE', tipo_hora:'ORDINARIA_DIURNA',   porcentaje:100, hora_inicio:'07:00:00', hora_fin:'16:15:00', jornada_maxima_minutos:420, es_liquidable:false },
  { dia_aplicacion:'LUN_JUE', tipo_hora:'EXTRA_DIURNA',       porcentaje:125, hora_inicio:'16:15:00', hora_fin:'19:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'LUN_JUE', tipo_hora:'ORDINARIA_NOCTURNA', porcentaje:135, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'LUN_JUE', tipo_hora:'EXTRA_NOCTURNA',     porcentaje:175, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  // VIE
  { dia_aplicacion:'VIE', tipo_hora:'ORDINARIA_DIURNA',   porcentaje:100, hora_inicio:'07:00:00', hora_fin:'16:10:00', jornada_maxima_minutos:420, es_liquidable:false },
  { dia_aplicacion:'VIE', tipo_hora:'EXTRA_DIURNA',       porcentaje:125, hora_inicio:'16:10:00', hora_fin:'19:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'VIE', tipo_hora:'ORDINARIA_NOCTURNA', porcentaje:135, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'VIE', tipo_hora:'EXTRA_NOCTURNA',     porcentaje:175, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  // SAB
  { dia_aplicacion:'SAB', tipo_hora:'ORDINARIA_DIURNA',   porcentaje:100, hora_inicio:'07:00:00', hora_fin:'07:00:00', jornada_maxima_minutos:420, es_liquidable:false },
  { dia_aplicacion:'SAB', tipo_hora:'EXTRA_DIURNA',       porcentaje:125, hora_inicio:'06:00:00', hora_fin:'19:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'SAB', tipo_hora:'ORDINARIA_NOCTURNA', porcentaje:135, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'SAB', tipo_hora:'EXTRA_NOCTURNA',     porcentaje:175, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  // DOM_FESTIVO
  { dia_aplicacion:'DOM_FESTIVO', tipo_hora:'ORDINARIA_DIURNA',                porcentaje:100, hora_inicio:'06:00:00', hora_fin:'19:00:00', jornada_maxima_minutos:420, es_liquidable:false },
  { dia_aplicacion:'DOM_FESTIVO', tipo_hora:'DOMINICAL_FESTIVA_DIURNA',        porcentaje:190, hora_inicio:'06:00:00', hora_fin:'19:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'DOM_FESTIVO', tipo_hora:'DOMINICAL_FESTIVA_NOCTURNA',      porcentaje:225, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'DOM_FESTIVO', tipo_hora:'EXTRA_DOMINICAL_FESTIVA_DIURNA',  porcentaje:215, hora_inicio:'06:00:00', hora_fin:'19:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
  { dia_aplicacion:'DOM_FESTIVO', tipo_hora:'EXTRA_DOMINICAL_FESTIVA_NOCTURNA',porcentaje:265, hora_inicio:'19:00:00', hora_fin:'06:00:00', jornada_maxima_minutos:420, es_liquidable:true  },
];

const SAL = 2_100_000;
const VHB = SAL / 210; // 10000

// ─── Tests ───────────────────────────────────────────────────

describe('getTipoDia', () => {
  test('lunes → LUN_JUE', () => expect(getTipoDia('2026-09-14', FESTIVOS_2026)).toBe('LUN_JUE'));
  test('viernes → VIE',   () => expect(getTipoDia('2026-09-18', FESTIVOS_2026)).toBe('VIE'));
  test('sábado → SAB',    () => expect(getTipoDia('2026-09-19', FESTIVOS_2026)).toBe('SAB'));
  test('domingo → DOM_FESTIVO', () => expect(getTipoDia('2026-09-20', FESTIVOS_2026)).toBe('DOM_FESTIVO'));
  test('festivo lunes (20-jul) → DOM_FESTIVO', () => expect(getTipoDia('2026-07-20', FESTIVOS_2026)).toBe('DOM_FESTIVO'));
});

describe('Motor — Días hábiles (LUN-JUE)', () => {
  const F = '2026-09-14';

  test('07:00-14:00 (exactamente 7h): sin extras', () => {
    // Jornada máxima = 420min = 7h. Exactamente 7h = sin extras.
    const r = calcularHorasExtrasMotor(F, '07:00', '14:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.totalHorasExtras).toBe(0);
    expect(r.totalLiquidado).toBe(0);
    expect(r.minutosPorTipo['ORDINARIA_DIURNA']).toBe(420);
  });

  test('07:00-17:15: genera extra diurna', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '17:15', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['EXTRA_DIURNA']).toBeGreaterThan(0);
    expect(r.totalLiquidado).toBeGreaterThan(0);
  });

  test('ORDINARIA_DIURNA: es_liquidable=false, subtotal=0', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '14:00', 0, SAL, CFG, FESTIVOS_2026);
    const seg = r.segmentos.find(s => s.tipo_hora === 'ORDINARIA_DIURNA');
    expect(seg?.es_liquidable).toBe(false);
    expect(seg?.subtotal).toBe(0);
    expect(r.totalLiquidado).toBe(0);
  });

  test('Valor hora base = salario/210', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '17:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.valorHoraBase).toBeCloseTo(VHB, 1);
  });

  test('05:00-12:00: ordinaria nocturna + ordinaria diurna', () => {
    const r = calcularHorasExtrasMotor(F, '05:00', '12:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['ORDINARIA_NOCTURNA']).toBeGreaterThan(0);
    expect(r.minutosPorTipo['ORDINARIA_DIURNA']).toBeGreaterThan(0);
  });
});

describe('Motor — Viernes', () => {
  const F = '2026-09-18';
  test('07:00-14:00 (7h exactas): sin extras en viernes', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '14:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.totalHorasExtras).toBe(0);
  });
  test('07:00-17:00: genera extra diurna', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '17:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['EXTRA_DIURNA']).toBeGreaterThan(0);
  });
});

describe('Motor — Sábado', () => {
  const F = '2026-09-19';
  test('07:00-12:00: todo extra diurna, sin ordinaria diurna', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '12:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['EXTRA_DIURNA']).toBeGreaterThan(0);
    expect(r.minutosPorTipo['ORDINARIA_DIURNA'] || 0).toBe(0);
  });
  test('18:00-21:00: nocturna en sábado', () => {
    const r = calcularHorasExtrasMotor(F, '18:00', '21:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['ORDINARIA_NOCTURNA']).toBeGreaterThan(0);
  });
});

describe('Motor — Domingo / Festivo', () => {
  const DOM = '2026-09-20';
  test('07:00-12:00: dominical festiva diurna', () => {
    const r = calcularHorasExtrasMotor(DOM, '07:00', '12:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.tipoDia).toBe('DOM_FESTIVO');
    expect(r.minutosPorTipo['DOMINICAL_FESTIVA_DIURNA']).toBeGreaterThan(0);
  });
  test('07:00-16:00: +7h → extra dominical diurna', () => {
    const r = calcularHorasExtrasMotor(DOM, '07:00', '16:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['EXTRA_DOMINICAL_FESTIVA_DIURNA']).toBeGreaterThan(0);
  });
  test('Festivo lunes = DOM_FESTIVO', () => {
    const r = calcularHorasExtrasMotor('2026-07-20', '08:00', '12:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.tipoDia).toBe('DOM_FESTIVO');
  });
  test('Nocturno domingo: dominical festiva nocturna', () => {
    const r = calcularHorasExtrasMotor(DOM, '20:00', '23:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.minutosPorTipo['DOMINICAL_FESTIVA_NOCTURNA']).toBeGreaterThan(0);
  });
  test('Porcentaje dom/fest diurna = 190', () => {
    const r = calcularHorasExtrasMotor(DOM, '07:00', '08:00', 0, SAL, CFG, FESTIVOS_2026);
    const seg = r.segmentos.find(s => s.tipo_hora === 'DOMINICAL_FESTIVA_DIURNA');
    expect(seg?.porcentaje).toBe(190);
  });
});

describe('Regla MAX(horas_remision, horas_calculadas)', () => {
  const F = '2026-09-14';
  test('horas_remision > calculadas → usa remision, alerta MAX_REMISION', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '08:00', 4, SAL, CFG, FESTIVOS_2026);
    expect(r.horasBaseLiquidacion).toBe(4);
    expect(r.alertaTipo).toBe('MAX_REMISION');
  });
  test('horas_calculadas > remision → usa calculadas', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '14:00', 3, SAL, CFG, FESTIVOS_2026);
    expect(r.horasBaseLiquidacion).toBeCloseTo(7, 0);
  });
  test('horas_remision=0 → usa calculadas', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '12:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.horasBaseLiquidacion).toBeCloseTo(r.horasCalculadas, 1);
  });
});

describe('Cruce de medianoche', () => {
  test('23:00-02:00: ~3h sin error', () => {
    const r = calcularHorasExtrasMotor('2026-09-14', '23:00', '02:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.horasCalculadas).toBeCloseTo(3, 1);
    expect(r.totalHorasExtras).toBeGreaterThan(0);
  });
});

describe('Alertas', () => {
  test('Sin hora inicio → SIN_TIEMPOS', () => {
    const r = calcularHorasExtrasMotor('2026-09-14', null, '16:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.alertaTipo).toBe('SIN_TIEMPOS');
  });
  test('inicio = fin → TIEMPOS_INVALIDOS', () => {
    const r = calcularHorasExtrasMotor('2026-09-14', '14:00', '14:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.alertaTipo).toBe('TIEMPOS_INVALIDOS');
  });
  test('Salario=0 → VHB=0, liquidado=0', () => {
    const r = calcularHorasExtrasMotor('2026-09-14', '07:00', '18:00', 0, 0, CFG, FESTIVOS_2026);
    expect(r.valorHoraBase).toBe(0);
    expect(r.totalLiquidado).toBe(0);
  });
});

describe('Gestión Humana — Regla de duplicación', () => {
  const F = '2026-09-14';
  test('Con nocturna ordinaria: GH >= extras', () => {
    const r = calcularHorasExtrasMotor(F, '05:00', '17:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.totalHorasGestionHumana).toBeGreaterThanOrEqual(r.totalHorasExtras);
  });
  test('Solo jornada ordinaria diurna: GH=0, extras=0', () => {
    const r = calcularHorasExtrasMotor(F, '07:00', '12:00', 0, SAL, CFG, FESTIVOS_2026);
    expect(r.totalHorasGestionHumana).toBe(0);
    expect(r.totalHorasExtras).toBe(0);
  });
  test('Nocturna ordinaria incluida en GH', () => {
    const r = calcularHorasExtrasMotor(F, '05:00', '08:00', 0, SAL, CFG, FESTIVOS_2026);
    const minNoctOrd = r.minutosPorTipo['ORDINARIA_NOCTURNA'] || 0;
    expect(minNoctOrd).toBeGreaterThan(0);
    expect(r.totalHorasGestionHumana * 60).toBeGreaterThanOrEqual(minNoctOrd);
  });
});

describe('Configuración dinámica (sin hardcoding)', () => {
  test('Cambiar % EXTRA_DIURNA cambia el total liquidado', () => {
    const F = '2026-09-14';
    const cfg125 = CFG.map(c => c.tipo_hora === 'EXTRA_DIURNA' ? { ...c, porcentaje: 125 } : c);
    const cfg150 = CFG.map(c => c.tipo_hora === 'EXTRA_DIURNA' ? { ...c, porcentaje: 150 } : c);
    const r1 = calcularHorasExtrasMotor(F, '07:00', '18:00', 0, SAL, cfg125, FESTIVOS_2026);
    const r2 = calcularHorasExtrasMotor(F, '07:00', '18:00', 0, SAL, cfg150, FESTIVOS_2026);
    expect(r2.totalLiquidado).toBeGreaterThan(r1.totalLiquidado);
  });
});
