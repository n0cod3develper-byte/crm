import axios from 'axios';

async function testCreateSolicitud() {
  try {
    const payload = {
      area_solicitante: 'Mantenimiento',
      fecha_requerida: '2026-05-01',
      prioridad: 'ALTA',
      justificacion: 'Repuestos urgentes',
      notas: 'Prueba desde script',
      items: [
        {
          item_inventario_id: null,
          descripcion: 'Filtro Aire',
          unidad: 'UND',
          cantidad_solicitada: 5,
          notas_item: 'Marca Bosch'
        }
      ]
    };

    const res = await axios.post('http://localhost:3001/api/compras/solicitudes', payload, {
      headers: {
        // I need a valid token. Since I can't easily get one, I might need to bypass auth or use a dev token.
      }
    });
    console.log('Success:', res.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// I can't run this without a token.
// Instead, I'll check the backend code for potential crashes.
