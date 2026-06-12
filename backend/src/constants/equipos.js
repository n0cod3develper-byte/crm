export const CAPACIDADES_NOMINALES = [
  { valor: 1.5, label: '1.5 Ton' },
  { valor: 2.0, label: '2.0 Ton' },
  { valor: 2.5, label: '2.5 Ton' },
  { valor: 3.0, label: '3.0 Ton' },
  { valor: 3.5, label: '3.5 Ton' },
  { valor: 4.0, label: '4.0 Ton' },
  { valor: 4.5, label: '4.5 Ton' },
  { valor: 5.0, label: '5.0 Ton' },
  { valor: 5.5, label: '5.5 Ton' },
  { valor: 6.0, label: '6.0 Ton' },
  { valor: 6.5, label: '6.5 Ton' },
  { valor: 7.0, label: '7.0 Ton' },
];

export const TIPOS_MASTIL = [
  { valor: 'SIMPLEX',    label: 'Simplex'    },
  { valor: 'DUPLEX',     label: 'Dúplex'     },
  { valor: 'TRIPLEX',    label: 'Tríplex'    },
  { valor: 'CUADRUPLEX', label: 'Cuádruple'  },
];

export const ALTURAS_MAXIMAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
  valor: n,
  label: `${n} m`,
}));

export const TIPOS_PROPULSION = [
  { valor: 'DIESEL',                  label: 'Diesel'                   },
  { valor: 'GAS',                     label: 'Gas'                      },
  { valor: 'DUAL',                    label: 'Dual'                     },
  { valor: 'ELECTRICO',               label: 'Eléctrico'                },
  { valor: 'GLP',                     label: 'GLP'                      },
  { valor: 'GASOLINA',                label: 'Gasolina'                 },
  { valor: 'ELECTRICO_BATERIA_LITIO', label: 'Eléctrico / Batería Litio'},
  { valor: 'ELECTRICO_BATERIA_PLOMO', label: 'Eléctrico / Batería Plomo'},
];

export const ESTADOS_EQUIPO = [
  { valor: 'OPERATIVO',         label: 'Operativo',         color: 'verde'   },
  { valor: 'EN_MANTENIMIENTO',  label: 'En Mantenimiento',  color: 'naranja' },
  { valor: 'FUERA_DE_SERVICIO', label: 'Fuera de Servicio', color: 'rojo'    },
  { valor: 'ALQUILADO',         label: 'Alquilado',         color: 'azul'    },
  { valor: 'RETIRADO',          label: 'Retirado',          color: 'gris'    },
];

export const TIPOS_EQUIPO = [
  { valor: 'MONTACARGAS', label: 'Montacargas', icono: '🏭' },
  { valor: 'ELEVADOR',    label: 'Elevador',    icono: '⬆️'  },
  { valor: 'CAMIONETA',   label: 'Camioneta',   icono: '🚐'  },
  { valor: 'AMBULANCIA',  label: 'Ambulancia',  icono: '🚑'  },
  { valor: 'VEHICULO',    label: 'Vehículo',    icono: '🚗'  },
];

// Tipos de equipo que pueden tener SOAT (montacargas también pueden tenerlo)
export const TIPOS_REQUIEREN_SOAT = ['MONTACARGAS', 'ELEVADOR', 'VEHICULO', 'CAMIONETA', 'AMBULANCIA'];

// Estados que requieren motivo obligatorio
export const ESTADOS_REQUIEREN_MOTIVO = ['FUERA_DE_SERVICIO', 'RETIRADO'];
