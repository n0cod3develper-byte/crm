import fs from 'fs';
import { generateOTPdf } from '../src/utils/pdfGenerator.js';

async function testPdf() {
  const commonOtData = {
    consecutivo: 'OT-00019',
    created_at: new Date().toISOString(),
    empresa_nombre: 'AEROCABLES S.A.',
    empresa_nit: '900.123.456-7',
    empresa_direccion: 'Calle 100 # 45-67, Edificio Centro Empresarial, Piso 4, Bogotá',
    contacto_empresa: 'Carlos Ramírez',
    telefono_contacto: '+57 300 123 4567',
    contacto_email: 'cramirez@aerocables.com',
    equipo_marca: 'Hyster',
    equipo_modelo: 'H50CT',
    equipo_serial: 'A213B12345',
    responsable: 'Juan Pérez',
    horometro_inicial: 15200,
    horometro_final: 15250,
    tecnicos_asignados: [{
      full_name: 'Técnico 1',
      fecha_salida: new Date().toISOString(),
      hora_salida: '08:00:00',
      fecha_regreso: new Date().toISOString(),
      hora_regreso: '17:00:00',
      tiempo_total_min: 540
    }],
    repuestos_insumos: [
      { descripcion: 'Filtro de Aceite', origen: 'PLANTILLA_PM', cantidad: 1, unidad: 'UND', precio_unitario: 50000, total: 50000 },
      { descripcion: 'Aceite Motor', origen: 'MANUAL', cantidad: 4, unidad: 'GL', precio_unitario: 25000, total: 100000 }
    ],
    liquidacion: {
      total_mano_obra: 150000,
      total_repuestos: 350000,
      subtotal: 500000,
      impuesto_pct: 19,
      impuesto_valor: 95000,
      total_final: 595000,
      notas_liquidacion: 'Trabajo realizado satisfactoriamente.',
      quote_snapshot: JSON.stringify({
        items: [
          { description: 'Filtro de Aire', quantity: 1, unit: 'UND', unit_price: 200000, discount: 0 }
        ]
      })
    }
  };

  const preventivoData = {
    ...commonOtData,
    tipo_mantenimiento: 'PREVENTIVO',
    frecuencia_nombre: '500 Horas',
    frecuencia_horas: 500,
    pm_actividades: [
      { orden: 1, codigo: 'ACT-001', nombre: 'Cambio de Aceite', estado: 'COMPLETADA', completada_por_nombre: 'Técnico 1', observacion: 'Sin novedad' },
      { orden: 2, codigo: 'ACT-002', nombre: 'Revisión Frenos', estado: 'OMITIDA', completada_por_nombre: 'Técnico 1', observacion: 'No aplica en este servicio' }
    ]
  };

  const correctivoData = {
    ...commonOtData,
    tipo_mantenimiento: 'CORRECTIVO',
    detalle_servicio: 'El equipo presenta fallas al arrancar en las mañanas. Se revisa sistema eléctrico y batería.',
    observaciones: 'Se recomienda reemplazar la batería en el corto plazo.',
    pm_actividades: []
  };

  try {
    const pdfBufferPrev = await generateOTPdf(preventivoData);
    fs.writeFileSync('test-preventivo.pdf', pdfBufferPrev);
    console.log('Saved test-preventivo.pdf');

    const pdfBufferCorr = await generateOTPdf(correctivoData);
    fs.writeFileSync('test-correctivo.pdf', pdfBufferCorr);
    console.log('Saved test-correctivo.pdf');
    
    process.exit(0);
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
}

testPdf();
